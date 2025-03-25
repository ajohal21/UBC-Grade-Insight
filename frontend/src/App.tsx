// frontend/src/App.tsx (or a new DatasetPage.tsx)
import { useState, useCallback } from 'react';
import AddDatasetSimple from './assets/AddDatasetSimple';
import ListDatasets from './assets/ListDataset';
import DatasetGraphs from './assets/DatasetGraphs';
import CourseSelector from './assets/CourseSelector'; // Import the new component
import './App.css';

function App() {
	const [updateKey, setUpdateKey] = useState<number>(0);
	const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
	const [selectedDept, setSelectedDept] = useState<string | null>(null); // New state for dept
	const [selectedCourse, setSelectedCourse] = useState<string | null>(null); // New state for course

	const handleDatasetAdded = useCallback(() => {
		setUpdateKey((prevKey) => prevKey + 1);
		setSelectedDataset(null);
		setSelectedDept(null);      // Clear selections on add
		setSelectedCourse(null);
	}, []);

	const handleDatasetRemoved = useCallback(() => {
		setUpdateKey((prevKey) => prevKey + 1);
		setSelectedDataset(null);  // Clear selections on remove
		setSelectedDept(null);
		setSelectedCourse(null);
	}, []);

	const handleDatasetSelected = useCallback((id: string) => {
		setSelectedDataset(id);
		setSelectedDept(null);      // Clear dept and course when dataset changes
		setSelectedCourse(null);
	}, []);

	const handleCourseSelected = useCallback((dept: string, courseId: string) => {
		setSelectedDept(dept);
		setSelectedCourse(courseId);
	}, []);


	return (
		<div className="App">
			<AddDatasetSimple onDatasetAdded={handleDatasetAdded} />
			<ListDatasets
				key={updateKey}
				onDatasetRemoved={handleDatasetRemoved}
				onDatasetSelected={handleDatasetSelected}
			/>
			{/* Conditionally render CourseSelector and DatasetGraphs */}
			{selectedDataset && (
				<>
					<CourseSelector datasetId={selectedDataset} onCourseSelect={handleCourseSelected} />
					{selectedDept && selectedCourse && (
						<DatasetGraphs datasetId={selectedDataset} dept={selectedDept} courseId={selectedCourse} />
					)}
				</>
			)}
		</div>
	);
}

export default App;
