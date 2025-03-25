// frontend/src/components/CourseSelector.tsx
import { useState, useEffect, useCallback } from 'react';
import {
	FormControl,
	InputLabel,
	Select,
	MenuItem,
	CircularProgress,
	Alert,
} from '@mui/material';
import { styled } from '@mui/system';

interface CourseSelectorProps {
	datasetId: string;
	onCourseSelect: (dept: string, courseId: string) => void;
}

// Create styled components
const StyledFormControl = styled(FormControl)({
	'& .MuiInputLabel-root': { // Target the InputLabel
		color: 'white',
	},
	'& .MuiSelect-select': { // Target the selected value in the Select
		color: 'white',
	},
	'& .MuiSvgIcon-root': { // Target the dropdown arrow icon
		color: 'white',
	},
	'& .MuiOutlinedInput-notchedOutline': { //target box border
		borderColor: 'white',
	},
});

const StyledMenuItem = styled(MenuItem)({
	color: 'black', // Set MenuItem text color (dropdown options)
});

function CourseSelector({ datasetId, onCourseSelect }: CourseSelectorProps) {
	const [departments, setDepartments] = useState<string[]>([]);
	const [courses, setCourses] = useState<string[]>([]);
	const [selectedDept, setSelectedDept] = useState('');
	const [selectedCourse, setSelectedCourse] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchDepartments = useCallback(async () => {
		if (!datasetId) return;
		setLoading(true);
		setError(null);
		try {
			// Query to fetch unique departments
			const query = {
				WHERE: {},
				OPTIONS: {
					COLUMNS: [`${datasetId}_dept`],
				},
				TRANSFORMATIONS: {
					GROUP: [`${datasetId}_dept`],
					APPLY:[]
				}
			};
			const response = await fetch('/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(query),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to fetch departments: ${errorData.error}`);
			}
			const data = await response.json();
			const deptList = data.result.map((item: any) => item[`${datasetId}_dept`]).filter((dept:string) => dept !== "");
			setDepartments(deptList);
			setCourses([]); // Clear courses when dataset changes
			setSelectedDept('');
			setSelectedCourse('');
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	}, [datasetId]);


	const fetchCourses = useCallback(async (dept: string) => {
		if (!datasetId || !dept) return;
		setLoading(true);
		setError(null);
		try {
			// Query to fetch unique courses within a department
			const query = {
				WHERE: {
					IS: {
						[`${datasetId}_dept`]: dept,
					},
				},
				OPTIONS: {
					COLUMNS: [`${datasetId}_id`],
				},
				TRANSFORMATIONS: {
					GROUP: [`${datasetId}_id`],
					APPLY:[],
				}
			};
			const response = await fetch('/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(query),
			});
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(`Failed to fetch courses: ${errorData.error}`);
			}
			const data = await response.json();
			const courseList = data.result.map((item: any) => item[`${datasetId}_id`]).filter((id: string) => id !== "");
			setCourses(courseList);
			setSelectedCourse(''); // Clear selected course when dept changes.
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	}, [datasetId]);

	useEffect(() => {
		fetchDepartments();
	}, [fetchDepartments]);

	useEffect(() => {
		if (selectedDept) {
			fetchCourses(selectedDept);
		}
	}, [selectedDept, fetchCourses]);


	const handleDeptChange = (event: any) => {
		setSelectedDept(event.target.value);
	};

	const handleCourseChange = (event: any) => {
		const course = event.target.value;
		setSelectedCourse(course);
		onCourseSelect(selectedDept, course);
	};

	return (
		<>
			<StyledFormControl fullWidth margin="normal" disabled={loading || !datasetId}>
				<InputLabel id="dept-select-label">Department</InputLabel>
				<Select
					labelId="dept-select-label"
					id="dept-select"
					value={selectedDept}
					label="Department"
					onChange={handleDeptChange}
				>
					{departments.map((dept) => (
						<StyledMenuItem key={dept} value={dept}>
							{dept}
						</StyledMenuItem>
					))}
				</Select>
			</StyledFormControl>

			<StyledFormControl fullWidth margin="normal" disabled={loading || !selectedDept}>
				<InputLabel id="course-select-label">Course</InputLabel>
				<Select
					labelId="course-select-label"
					id="course-select"
					value={selectedCourse}
					label="Course"
					onChange={handleCourseChange}
				>
					{courses.map((course) => (
						<StyledMenuItem key={course} value={course}>
							{course}
						</StyledMenuItem>
					))}
				</Select>
			</StyledFormControl>
			{loading && <CircularProgress />}
			{error && <Alert severity="error">{error}</Alert>}
		</>
	);
}

export default CourseSelector;
