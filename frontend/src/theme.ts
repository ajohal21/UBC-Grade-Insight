// frontend/src/theme.ts
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
	palette: {
		primary: {
			main: '#1976d2', // Blue, a good default
		},
		secondary: {
			main: '#dc004e', // Pink, a good secondary
		},
		error: {
			main: '#f44336', // Red
		},
		background: {
			default: '#fff',  // White background
		},
	},
	typography: {
		fontFamily: [
			'Roboto', // Use Roboto
			'"Helvetica Neue"',
			'Arial',
			'sans-serif',
		].join(','),
	},
	// You can add other customizations here:
	// spacing: (factor) => `${0.25 * factor}rem`, // Example spacing
	// breakpoints: { ... }, // Custom breakpoints
	// components: { ... }, // Override default component styles
});

export default theme;
