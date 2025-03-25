import { useState, useEffect, useCallback } from 'react';
import {
	Typography,
	Container,
	CircularProgress,
	Alert,
} from '@mui/material';
import { styled } from '@mui/system';
import {
	LineChart,
	Line,
	BarChart,
	Bar,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
	ResponsiveContainer,
	Label,
	PieChart,
	Pie,
	Cell,
} from 'recharts';

const StyledContainer = styled(Container)(({ theme }) => ({
	marginTop: theme.spacing(4),
}));

interface DatasetGraphsProps {
	datasetId: string;
	dept: string;       // Now takes dept
	courseId: string;   // and courseId as props
}

interface GraphData {
	year: number;
	average: number;
}

interface PassFailData {
	year: number;
	pass: number;
	fail: number;
}

interface InstructorAverageData {
	instructor: string;
	average: number;
}

const CustomTooltipLine = ({ active, payload, label }: any) => {
	if (active && payload && payload.length) {
		return (
			<div style={{
				backgroundColor: 'white',
				border: '1px solid #ccc',
				padding: '10px',
				borderRadius: '4px'
			}}>
				<p style={{ color: 'black' }}>Year: {label}</p>
				<p style={{ color: 'black' }}>Average: {payload[0].value.toFixed(2)}</p>
			</div>
		);
	}
	return null;
};

const CustomTooltipBar = ({ active, payload, label }: any) => {
	if (active && payload && payload.length) {
		return (
			<div style={{
				backgroundColor: 'white',
				border: '1px solid #ccc',
				padding: '10px',
				borderRadius: '4px',
			}}>
				<p style={{ color: 'black' }}>Year: {label}</p>
				<p style={{ color: 'black' }}>Pass: {payload[0].value}</p>
				<p style={{ color: 'black' }}>Fail: {payload[1].value}</p>
			</div>
		);
	}

	return null;
};

const CustomTooltipPie = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		return (
			<div style={{
				backgroundColor: 'white',
				border: '1px solid #ccc',
				padding: '10px',
				borderRadius: '4px'
			}}>
				<p style={{ color: 'black' }}>Instructor: {payload[0].name}</p>
				<p style={{ color: 'black' }}>Average: {payload[0].value.toFixed(2)}</p>
			</div>
		);
	}
	return null;
};



function DatasetGraphs({ datasetId, dept, courseId }: DatasetGraphsProps) { // Updated props
	const [lineGraphData, setLineGraphData] = useState<GraphData[]>([]);
	const [barGraphData, setBarGraphData] = useState<PassFailData[]>([]);
	const [pieChartData, setPieChartData] = useState<InstructorAverageData[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF0000', '#00FF00'];

	const fetchGraphData = useCallback(async () => {
		if (!datasetId || !dept || !courseId) { // Don't fetch if not all data is available
			setLoading(false); // Important: still set loading to false
			return;
		}


		setLoading(true);
		setError(null);

		try {
			const query1 = {
				WHERE: {
					AND: [
						{
							IS: {
								[`${datasetId}_dept`]: dept, // Use the dept prop
							}
						},
						{
							IS: {
								[`${datasetId}_id`]: courseId, // Use the courseId prop
							}
						}
					]
				},
				OPTIONS: {
					COLUMNS: [
						`${datasetId}_avg`,
						`${datasetId}_year`,
						'avgGrade'
					],
					ORDER: {
						dir: "UP",
						keys: [`${datasetId}_year`]
					}
				},
				TRANSFORMATIONS: {
					GROUP: [`${datasetId}_year`],
					APPLY: [{
						avgGrade: {
							AVG: `${datasetId}_avg`
						}
					}]
				}
			};
			const query2 = {
				WHERE: {
					AND: [
						{
							IS: {
								[`${datasetId}_dept`]: dept,
							}
						},
						{
							IS: {
								[`${datasetId}_id`]: courseId,
							}
						},
						{
							NOT: {
								EQ: {
									[`${datasetId}_year`]: 1900
								}
							}
						}
					]
				},
				OPTIONS: {
					COLUMNS: [
						`${datasetId}_year`,
						"passCount",
						"failCount",
					],
					ORDER: `${datasetId}_year`
				},
				TRANSFORMATIONS: {
					GROUP: [`${datasetId}_year`],
					APPLY: [
						{
							passCount: {
								SUM: `${datasetId}_pass`,
							},
						},
						{
							failCount: {
								SUM: `${datasetId}_fail`,
							},
						},
					],
				},
			};

			const query3 = {
				WHERE: {
					AND: [
						{
							IS: {
								[`${datasetId}_dept`]: dept,
							}
						},
						{
							IS: {
								[`${datasetId}_id`]: courseId,
							}
						}
					]
				},
				OPTIONS: {
					COLUMNS: [
						`${datasetId}_instructor`,
						"instructorAverage",
					],
					ORDER: {
						dir: "DOWN",
						keys: ["instructorAverage"]
					}
				},
				TRANSFORMATIONS: {
					GROUP: [`${datasetId}_instructor`],
					APPLY: [
						{
							instructorAverage: {
								AVG: `${datasetId}_avg`,
							},
						},
					],
				},
			};

			const [response1, response2, response3] = await Promise.all([
				fetch('/query', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(query1),
				}),
				fetch('/query', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(query2),
				}),
				fetch('/query', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(query3),
				}),
			]);

			if (!response1.ok) {
				const errorData = await response1.json();
				throw new Error(`Query 1 failed: ${errorData.error}`);
			}
			if (!response2.ok) {
				const errorData = await response2.json();
				throw new Error(`Query 2 failed: ${errorData.error}`);
			}
			if (!response3.ok) {
				const errorData = await response3.json();
				throw new Error(`Query 3 failed: ${errorData.error}`);
			}

			const data1 = await response1.json();
			const transformedData1: GraphData[] = data1.result && Array.isArray(data1.result)
				? data1.result.map((item: any) => ({
					year: item[`${datasetId}_year`],
					average: item.avgGrade,
				}))
				: [];
			setLineGraphData(transformedData1);

			const data2 = await response2.json();
			const transformedData2: PassFailData[] = data2.result && Array.isArray(data2.result)
				? data2.result.map((item: any) => ({
					year: item[`${datasetId}_year`],
					pass: item.passCount,
					fail: item.failCount,
				}))
				: [];
			setBarGraphData(transformedData2);

			const data3 = await response3.json();
			const transformedData3: InstructorAverageData[] = data3.result && Array.isArray(data3.result)
				? data3.result.map((item: any) => ({
					instructor: item[`${datasetId}_instructor`],
					average: item.instructorAverage,
				}))
				: [];
			setPieChartData(transformedData3);

		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	}, [datasetId, dept, courseId]); // Depend on dept and courseId

	useEffect(() => {
		fetchGraphData();
	}, [fetchGraphData]);

	return (
		<StyledContainer>
			<Typography variant="h4" gutterBottom>
				Graphs for Dataset: {datasetId}, Dept: {dept}, Course: {courseId} {/* Display selection */}
			</Typography>

			{loading ? (
				<CircularProgress />
			) : error ? (
				<Alert severity="error">{error}</Alert>
			) : (
				<>
					{/* Line Chart */}
					<ResponsiveContainer width="100%" height={300}>
						<LineChart
							data={lineGraphData}
							margin={{ top: 40, right: 20, bottom: 20, left: 0 }}
						>
							<CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
							<XAxis dataKey="year">
								<Label value="Year" offset={-5} position="insideBottom" />
							</XAxis>
							<YAxis>
								<Label value="Average" angle={-90} position="insideLeft" offset={-5} />
							</YAxis>
							<Tooltip content={<CustomTooltipLine />} />
							<Legend />
							<Line type="monotone" dataKey="average" stroke="#8884d8" />
							<text x="50%" y={20} textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
								{dept} {courseId} Class Average  {/* Dynamic Title */}
							</text>
						</LineChart>
					</ResponsiveContainer>

					{/* Bar Chart */}
					<ResponsiveContainer width="100%" height={300}>
						<BarChart
							data={barGraphData}
							margin={{ top: 40, right: 30, left: 0, bottom: 20 }}
						>
							<CartesianGrid strokeDasharray="3 3" />
							<XAxis dataKey="year">
								<Label value="Year" offset={-5} position="insideBottom" />
							</XAxis>
							<YAxis>
								<Label value="Count" angle={-90} position="insideLeft" offset={-5} />
							</YAxis>
							<Tooltip content={<CustomTooltipBar />} />
							<Legend />
							<Bar dataKey="pass" fill="#82ca9d" />
							<Bar dataKey="fail" fill="#8884d8" />
							<text x="50%" y={20} textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
								{dept} {courseId} Pass/Fail Counts {/* Dynamic Title */}

							</text>
						</BarChart>
					</ResponsiveContainer>

					{/* Pie Chart */}
					<ResponsiveContainer width="100%" height={400}>
						<PieChart margin={{ top: 70, right: 20, bottom: 80, left: 20 }}>
							<Pie
								data={pieChartData}
								cx="50%"
								cy="50%"
								outerRadius={80}
								fill="#8884d8"
								dataKey="average"
								nameKey="instructor"
								label
							>
								{pieChartData.map((_entry, index) => (
									<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
								))}
							</Pie>
							<Tooltip content={<CustomTooltipPie />} />
							<Legend
								verticalAlign="bottom"
								align="center"
								layout="horizontal"
								wrapperStyle={{
									paddingTop: '10px',
								}}
							/>
							<text x="50%" y={15} textAnchor="middle" fontSize="16" fontWeight="bold" fill="white">
								{dept} {courseId} Instructor Averages  {/* Dynamic Title */}
							</text>
						</PieChart>
					</ResponsiveContainer>
				</>
			)}
		</StyledContainer>
	);
}

export default DatasetGraphs;
