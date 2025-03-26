// frontend/src/components/AddDatasetSimple.tsx
import React, { useState, useCallback } from 'react';

interface AddDatasetProps {
	onDatasetAdded: () => void; // Prop to signal a new dataset
}

function AddDatasetSimple({ onDatasetAdded }: AddDatasetProps) { // Receive the prop
	const [datasetId, setDatasetId] = useState<string>('');
	const [file, setFile] = useState<File | null>(null);
	const [responseCode, setResponseCode] = useState<number | null>(null);
	const [successMessage, setSuccessMessage] = useState<string | null>(null); // Add success message
	const [error, setError] = useState<string | null>(null);

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files[0]) {
			setFile(event.target.files[0]);
		}
	};

	const handleIdChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setDatasetId(event.target.value);
	};

	const addDataset = useCallback(async () => {
		if (!datasetId || !file) {
			setError('Please enter an ID and select a file.');
			setResponseCode(400);
			return;
		}
		setError(null);
		setResponseCode(null);
		setSuccessMessage(null); // Clear previous success message

		try {
			const fileContent: ArrayBuffer = await readFileAsArrayBuffer(file);
			console.log("File Content:", fileContent); // Log before sending
			// Hardcode 'courses' as the kind
			const response = await fetch(`/dataset/${datasetId}/sections`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/octet-stream',
				},
				body: fileContent,
			});

			setResponseCode(response.status);

			if (!response.ok) {
				const errorData = await response.json();
				setError(`Error: ${errorData.error}`);
			} else {
				await response.json(); //get the data
				setSuccessMessage(`Dataset "${datasetId}" added successfully!`); // Use the returned ID
				setDatasetId('');  // Clear input field on success
				if (document != null) { //clear input
					(document.getElementById('datasetFile') as HTMLInputElement).value = '';
				}
				setFile(null);
				onDatasetAdded(); // Call the callback function!
			}

		} catch (err: any) {
			setError(`Network or other error: ${err.message}`);
		}
	}, [datasetId, file, onDatasetAdded]);

	const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result as ArrayBuffer);
			reader.onerror = () => reject(reader.error);
			reader.readAsArrayBuffer(file);
		});
	};

	return (
		<div>
			<h1>Add Dataset: </h1>

			<div>
				<label htmlFor="datasetId">Dataset ID:</label>
				<input
					type="text"
					id="datasetId"
					value={datasetId}
					onChange={handleIdChange}
				/>
			</div>

			<div>
				<label htmlFor="datasetFile">Dataset File:</label>
				<input type="file" id="datasetFile" onChange={handleFileChange} />
			</div>

			<button onClick={addDataset}>Add Dataset</button>

			{responseCode && (
				<p>Response Code: {responseCode}</p>
			)}

			{successMessage && (
				<p style={{ color: 'green' }}>{successMessage}</p>
			)}

			{error && (
				<p style={{ color: 'red' }}>{error}</p>
			)}
		</div>
	);
}

export default AddDatasetSimple;
