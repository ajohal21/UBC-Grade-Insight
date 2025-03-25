// frontend/src/components/ListDatasets.tsx
import { useState, useEffect, useCallback } from 'react';
import {
	List,
	ListItem,
	ListItemText,
	Typography,
	Container,
	CircularProgress,
	Alert,
	IconButton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogContentText,
	DialogActions,
	Button,
	Link, // Import Link from MUI
} from '@mui/material';
import { styled } from '@mui/system';
import DeleteIcon from '@mui/icons-material/Delete';

interface InsightDataset {
	id: string;
	kind: string;
	numRows: number;
}

const StyledContainer = styled(Container)(({ theme }) => ({
	marginTop: theme.spacing(4),
}));

const StyledList = styled(List)(({ theme }) => ({
	width: '100%',
	backgroundColor: theme.palette.background.paper,
	borderRadius: theme.shape.borderRadius,
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
	display: 'flex',
	justifyContent: 'space-between',
	alignItems: 'center',
	borderBottom: `1px solid ${theme.palette.divider}`,
	'&:last-child': {
		borderBottom: 'none',
	},
}));

const StyledListItemText = styled(ListItemText)({
	'& .MuiListItemText-primary': {
		color: 'black',
	},
	'& .MuiListItemText-secondary': {
		color: 'black',
	},
});

interface ListDatasetsProps {
	onDatasetRemoved: () => void;
	onDatasetSelected: (id: string) => void; // Add this prop
}

function ListDatasets({ onDatasetRemoved, onDatasetSelected }: ListDatasetsProps) {
	const [datasets, setDatasets] = useState<InsightDataset[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [openDialog, setOpenDialog] = useState(false);
	const [datasetToRemove, setDatasetToRemove] = useState<string | null>(null);

	const fetchDatasets = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch('/datasets');
			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to fetch datasets');
			}
			const data = await response.json();
			setDatasets(data.result);
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchDatasets();
	}, [fetchDatasets]);

	const handleRemoveClick = (id: string) => {
		setDatasetToRemove(id);
		setOpenDialog(true);
	};

	const handleConfirmRemove = async () => {
		if (!datasetToRemove) return;

		try {
			const response = await fetch(`/dataset/${datasetToRemove}`, {
				method: 'DELETE',
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to remove dataset');
			}

			setOpenDialog(false);
			setDatasetToRemove(null);
			onDatasetRemoved();
		} catch (err: any) {
			setError(err.message || 'An unexpected error occurred during removal');
			setOpenDialog(false);
		}
	};

	const handleCancelRemove = () => {
		setOpenDialog(false);
		setDatasetToRemove(null);
	};

	return (
		<StyledContainer>
			<Typography variant="h4" gutterBottom>
				List of Datasets
			</Typography>

			{loading ? (
				<CircularProgress />
			) : error ? (
				<Alert severity="error">{error}</Alert>
			) : datasets.length === 0 ? (
				<Typography variant="body1">No datasets present.</Typography>
			) : (
				<StyledList>
					{datasets.map((dataset) => (
						<StyledListItem key={dataset.id}>
							<StyledListItemText
								primary={
									<Link
										component="button" // Make it a button for accessibility
										variant="body1"
										onClick={() => onDatasetSelected(dataset.id)} // Call onDatasetSelected
										sx={{color: 'black'}} //added this to ensure it looks how we want
									>
										Dataset ID: {dataset.id}
									</Link>
								}
								secondary={`Kind: ${dataset.kind}, Rows: ${dataset.numRows}`}
							/>
							<IconButton
								edge="end"
								aria-label="delete"
								onClick={() => handleRemoveClick(dataset.id)}
								sx={{ color: 'red' }}
							>
								<DeleteIcon />
							</IconButton>
						</StyledListItem>
					))}
				</StyledList>
			)}

			<Dialog
				open={openDialog}
				onClose={handleCancelRemove}
				aria-labelledby="alert-dialog-title"
				aria-describedby="alert-dialog-description"
			>
				<DialogTitle id="alert-dialog-title">{"Confirm Removal"}</DialogTitle>
				<DialogContent>
					<DialogContentText id="alert-dialog-description">
						Are you sure you want to remove dataset {datasetToRemove}?
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleCancelRemove} color="primary">
						Cancel
					</Button>
					<Button onClick={handleConfirmRemove} color="primary" autoFocus>
						Remove
					</Button>
				</DialogActions>
			</Dialog>
		</StyledContainer>
	);
}

export default ListDatasets;
