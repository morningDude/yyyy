 

import './App.css';
import { CertificateParser, ValueSetMapper, ValueSet } from 'covid-certificate-parser';
import { Decoder } from '@nuintun/qrcode';
import cose from 'cose-js';
import base45 from 'base45-js'
import zlib from 'pako'
import 'antd/dist/antd.css';
import { Layout, Input } from 'antd';
import { useState } from 'react';
import { Image } from 'antd';

const { Search ,TextArea} = Input;

const { Header, Content } = Layout;


const App = () => {
  const [qr, setQr] = useState("")
  const [certificate, setCertificate] = useState(null)
  const [validate, setValidate] = useState("")
  const [color, setColor] = useState("red")

  //Verificador COSE con la llave 
  const getPublicKeyVerificator = () => {
    //LLave publica en hexadecimal
    const pkHex = Buffer.from("04add55cf5ad1b96d47a8e6d413d3037bb473224d60ab85d6e464f21ee1d38f9705127d9181edfbfa120d7c2659728ce9c1029dc9aa68acf50fd5313b516974177", "hex")
    const fingerprint = [
      217, 25, 55, 95, 193, 231, 182,
      178, 252, 241, 176, 161, 250, 212,
      129, 111, 232, 123, 185, 97, 248,
      188, 88, 127, 88, 17, 143, 12,
      254, 41, 219, 52
    ];
    const keyX = Buffer.from(pkHex.slice(1, 1 + 32))
    const keyY = Buffer.from(pkHex.slice(33, 33 + 32))
    const keyID = fingerprint.slice(0, 8)
    return { 'key': { 'x': keyX, 'y': keyY, 'kid': keyID } };
  }

  //Normalizar data
  const getNormalizeCertificateData = (certificateBase45) => {
    
    if (certificateBase45.startsWith('HC1')) {
      certificateBase45 = certificateBase45.substring(3)
      if (certificateBase45.startsWith(':')) {
        certificateBase45 = certificateBase45.substring(1)
      } else {
        console.log("Warning: unsafe HC1: header - update to v0.0.4");
      };
    } else {
      console.log("Warning: no HC1: header - update to v0.0.4");
    };
 
    certificateBase45 = base45.decode(certificateBase45)     
    if (certificateBase45[0] === 0x78) {
      certificateBase45 = zlib.inflate(certificateBase45)
    }
    return certificateBase45
  }

   

  //Validar el certificado con la firma
  const validateCertificateCovid = (certificateBase45) => {
    let verificator = getPublicKeyVerificator()
    let certificate = getNormalizeCertificateData(certificateBase45)
 
    cose.sign.verify(certificate, verificator)
      .then((buf) => {
        setColor("green")
        setValidate('Verified message: ' + buf.toString('utf8'));
      }).catch((error) => {
        console.log(error);
        setColor("red")
        setValidate(error.message);
      });
  }


  //Escanear y sacar datos del QR
  const scannerQR = (qrImage) => {

    const qrcode = new Decoder();
    qrcode.scan(qrImage).then(qrRaw => CertificateParser.ParseQrPayload(qrRaw.data).subscribe(certContainer => {
      console.log("Prefixed Compressed COSE (Base45) (547 chars):")
      console.log(qrRaw.data.length)


      const valueSetMapper = new ValueSetMapper();
      console.log(certContainer)
      //Personal Information
      //Name(s)
      let names = certContainer.certificate.nam.fn + ", " + certContainer.certificate.nam.gn
      //Transliterated name(s):
      let transliteratedName = certContainer.certificate.nam.fnt + ", " + certContainer.certificate.nam.gnt
      //Date of birth:
      let DateOfBirth = certContainer.certificate.dob

      console.log("Personal Information")
      console.log("   Name(s): " + names)
      console.log("   Transliterated name(s): " + transliteratedName)
      console.log("   Date of birth: " + DateOfBirth)

      let Vaccination = []
      certContainer.certificate.v.forEach((element, index) => {
        console.log(`Vaccination (entry ${index + 1})`)

        //Unique Certificate Identifier (UVCI)  
        let UVCI = element.ci
        //Country of vaccination
        let CountryOfVaccination = valueSetMapper.getValue(ValueSet.CountryCode, element.co)
        let Country = element.co
        //Issuer of certificate
        let IssuerOfCertificate = element.is
        //Name of vaccine
        let NameOfVaccine = `${valueSetMapper.getValue(ValueSet.Vaccine, element.mp)} (${element.mp})`
        //Targeted disease
        let TargetedDisease = `${valueSetMapper.getValue(ValueSet.Disease, element.tg)} (${element.tg})`
        //Prophylaxis
        let Prophylaxis = `${valueSetMapper.getValue(ValueSet.VaccineProphylaxis, element.vp)} (${element.vp})`
        //Manufacturer
        let Manufacturer = `${valueSetMapper.getValue(ValueSet.VaccineManufacturer, element.ma)} (${element.ma})`
        //Doses
        let Doses = `${element.sd} out of ${element.dn}`
        //Date Of Vaccination
        let DateOfVaccination = `${element.dt}`


        console.log("    Unique Certificate Identifier (UVCI): " + UVCI)
        console.log("    Country of vaccination: " + CountryOfVaccination + "(" + Country + ")")
        console.log("    Issuer of certificate: " + IssuerOfCertificate)
        console.log(`    Name of vaccine: ${NameOfVaccine}`)
        console.log(`    Targeted disease: ${TargetedDisease}`)
        console.log(`    Prophylaxis: ${Prophylaxis}`)
        console.log(`    Manufacturer: ${Manufacturer}`)
        console.log(`    Doses: ${Doses}`)
        console.log(`    Date Of Vaccination: ${DateOfVaccination}`)

        Vaccination.push({
          UVCI,
          CountryOfVaccination,
          Country,
          NameOfVaccine,
          TargetedDisease, Prophylaxis, Manufacturer, Doses, DateOfVaccination
        })
      });

      //Technical Metadata
      //Version
      let version = certContainer.certificate.ver

      //Issuer
      let cwtIssuer = certContainer.cwtIssuer

      //Issued at
      let IssuedAt = certContainer.cwtIssuedAt

      //ExpiringAt
      let ExpiringAt = certContainer.cwtExpirationTime

      //Algorithm
      let Algorithm = `${certContainer.coseAlgorithmName} (${certContainer.coseAlgorithm})`


      console.log("Technical Metadata ")
      console.log("   Version: " + version)
      console.log("    Issuer: " + cwtIssuer)
      console.log(`    Issued At: ${IssuedAt}`)
      console.log(`    Expiring At: ${ExpiringAt}`)
      console.log(`    Algorithm: ${Algorithm}`)


      setCertificate({
        names,
        transliteratedName,
        DateOfBirth,
        Vaccination,
        version,
        cwtIssuer,
        IssuedAt,
        ExpiringAt,
        Algorithm
      })

      validateCertificateCovid(qrRaw.data)
    }))



  }


  const onSearch = (file) => {
    setCertificate(null)
    setValidate("")
    setQr("")
    setTimeout(()=>{
      setQr(file)
    scannerQR(file)
    },1000)
    
  }
  return (
    <Layout>
      <Header className="header">

      </Header>
      <Layout>

        <Layout style={{ padding: '0 24px 24px' }}>

          <Content
            className="site-layout-background"
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
            }}
          >
            <strong>GENERAR QR DE PRUEBA AQUI: </strong> 
            <a target="blank" href="https://dgc.a-sit.at/ehn/">https://dgc.a-sit.at/ehn/</a>
            <br />
            <strong>URL DEL QR:</strong><br />
            <Search   placeholder="input search text" allowClear onSearch={onSearch} style={{ width: "100%" }} />

            <br />
            <Image
              width={200}
              src={qr}
            />
            <br />
            {certificate && <>
              <br /><br /><br />
              <strong style={{color:color}}>MESSAGE VALIDATE CERTIFICATE COVID:</strong><br/>{validate}
            </>}
            <br /><br />
            <strong style={{color:color}}>QR DATA</strong><br /><br />
            {certificate &&

              <TextArea value={JSON.stringify(certificate, undefined, 4)}   readOnly name="" id="myTextarea" cols="40" rows="10">
                
              </TextArea>
            }

          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
