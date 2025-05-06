import React, {useRef, useState} from 'react';
import Webcam from 'react-webcam';

const {Liferay, themeDisplay} = window;

function MMRApiClient(props) {
	console.log(props);

	// captureStatus is either picture, confirm or edit
	const [captureStatus, setCaptureStatus] = useState("picture");
	const [model, setModel] = useState("");
	const [make, setMake] = useState("");
	const [licensePlate, setLicensePlate] = useState("");


	const [makerVocabularyId, setMakerVocabularyId] = useState("");
	const [makerId, setMakerId] = useState("");
	const [modelId, setModelId] = useState("");


	let layoutURL = Liferay.ThemeDisplay.getLayoutURL();
	const lastSlash = layoutURL.lastIndexOf('/');
	// Extract the domain+website
	const websiteURL = layoutURL.substring(0, lastSlash + 1);

	const webcamRef = useRef(null);
	const [imgSrc, setImgSrc] = useState(null);
	const myHeaders = new Headers();

	async function registerVehicle()  {
		let loggedUserId =  Liferay.ThemeDisplay.getUserId();
		await Liferay.Util.fetch('/o/c/registeredvehicles', {
			method: 'POST',
			headers: [
				['Content-type', 'application/json'],
				['Accept', 'application/json']
			],
			body: JSON.stringify({
				maker: make,
				model: model,
				plate: licensePlate,
				r_carMechanic_userId: loggedUserId
			  }),
		  })
		setCaptureStatus("complete");
		}

	async function asyncDetectedModelCategory (maker, model)  {
		let carmakerVocabularyId = await asyncFetchModelVocabulary();
		let carmakerCategoryId = await asyncFetchMakerCategory(maker,carmakerVocabularyId);
		return await asyncFetchModelCategory(model, carmakerCategoryId);
	}

	async function asyncFetchModelVocabulary() {
		//Get Vocabulary Id of the Makers vocabulary
		const makerVocabularyResponse = await Liferay.Util.fetch("/o/headless-admin-taxonomy/v1.0/sites/"+props.globalSiteId+"/taxonomy-vocabularies?filter=name eq '"+props.MakerCategoryName+"'");
		const makerVocabularyData = await makerVocabularyResponse.json();
		const makerVocabularyId = await makerVocabularyData.items[0].id;
		await setMakerVocabularyId(makerVocabularyId);
		return makerVocabularyId;
	}

	async function retryCapture() {
		setCaptureStatus("picture");
	}

	async function asyncFetchMakerCategory(maker,makerVocabularyId) {
		//Get maker category Id
		const makerCategoryResponse = await Liferay.Util.fetch("/o/headless-admin-taxonomy/v1.0/taxonomy-vocabularies/"+makerVocabularyId+"/taxonomy-categories?filter=name eq '"+maker+"'");
		const makerCategoryData = await makerCategoryResponse.json();
		const makerCategoryId =  makerCategoryData.items[0].id;
		await setMakerId(makerCategoryId);
		return makerCategoryId;
	}

	async function asyncFetchModelCategory(model,makerCategoryId) {
		//Get model category Id
		const modelCategoryResponse = await Liferay.Util.fetch("/o/headless-admin-taxonomy/v1.0/taxonomy-categories/"+makerCategoryId+"/taxonomy-categories?filter=name eq '"+model+"'");
		const modelCategoryData = await modelCategoryResponse.json();
		const modelCategoryId = modelCategoryData.items[0].id;
		await setModelId(modelCategoryId);
		return modelCategoryId;
	}
		  
	async function capture() {
		myHeaders.append("apikey", props.apikey);
		const imageSrc = webcamRef.current.getScreenshot();
		setImgSrc(imageSrc);

		  // Convert imageSrc to a Blob
		const blob = await fetch(imageSrc).then(res => res.blob());
		  // Create form-data body
		const formData = new FormData();
		  // Append the image to the form-data
		formData.append('file', blob, 'car-image.jpg');

		const response = await Liferay.Util.fetch('https://trafficeye.ai/recognition', {
				method: 'POST',
				headers: myHeaders,
				body: formData,
				redirect: "follow"
			  });

		const data = await response.json();

		const tempmake = data.data.combinations[0].roadUsers[0].mmr.make.value;
		const tempmodel = data.data.combinations[0].roadUsers[0].mmr.model.value;
		const tempplate = data.data.combinations[0].roadUsers[0].plates[0].text.value;

		setMake(tempmake);
		setModel(tempmodel);
		setLicensePlate(tempplate);

		await asyncDetectedModelCategory(tempmake,tempmodel);
		setCaptureStatus("confirm");
		}

		if (captureStatus === "picture") {
			return (
			<div className="webcam-container">
			<Webcam
			  audio={false}
			  ref={webcamRef}
			  screenshotFormat="image/jpeg"
			/>
			<br />
			<button onClick={capture} className="btn btn-large btn-primary">Capture</button>
			</div>);
		}

		if (captureStatus === "confirm") {
			return (
				<div className="confirm-container">
					{imgSrc && <img src={imgSrc} alt="captura"/>}
					<br/>
					<div className="data-field-label">Make</div>
					<div className="data-field">{make}</div>
					<br/>
					<div className="data-field-label">Model</div>
					<div className="data-field">{model}</div>
					<br/>
					<div className="data-field-label">License Plate</div>
					<div className="data-field">{licensePlate}</div>
					<br />
					<div className="button-row">
						<button className="btn btn-large btn-secondary" onClick={retryCapture}>Try Again</button>
						<button className="btn btn-large btn-primary" onClick={registerVehicle}>OK</button>
					</div>
				</div>

			);
		}

		if (captureStatus === "complete") {
			return(
				<div className="confirm-container">
					{imgSrc && <img src={imgSrc} alt="captura"/>}
					<br/>
					<h2>Registration Successful</h2>
					<div className="completed-message">You can get replacement parts for the {make} {model} at the link below.</div>
					<br/>
					<a href= {websiteURL + props.catalogPage + "?category=" + modelId}>
						<button className="btn btn-large btn-primary">Spare Parts</button>
					</a>
				</div>
			);
		}
}


export default MMRApiClient;
