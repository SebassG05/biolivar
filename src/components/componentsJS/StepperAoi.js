import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { DropzoneArea } from 'material-ui-dropzone';

const steps = ['Date Selection', 'Choose Index Type', 'Upload Data'];

export default function HorizontalLinearStepperAOI({onSubmit, onIndexTypeChange, onStepChange, loading, setLoading, startDate, endDate, onDateChange}) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState({
    startDate: startDate || '',
    endDate: endDate || '',
    indexType: '',
    aoiDataFiles: []
  });

  useEffect(() => {
    if (typeof onStepChange === 'function') {
      onStepChange(activeStep);
    }
  }, [activeStep, onStepChange]);

  // Actualiza formData si cambian las props iniciales
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      startDate: startDate || '',
      endDate: endDate || ''
    }));
  }, [startDate, endDate]);

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSubmit = async () => {
    if (typeof setLoading === 'function') setLoading(true);
    try {
        await onSubmit([formData]);
    } catch (error) {
        console.error("Error fetching data: ", error);
    }
    // NO pongas setLoading(false) aquí, el padre lo hará cuando termine la petición
  };

  const handleReset = () => {
    setActiveStep(0);
    setFormData({
      startDate: '',
      endDate: '',
      indexType: '',
      soilDataFiles: [],
      aoiDataFiles: []
    });
  };

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
    if (event.target.name === 'indexType' && typeof onIndexTypeChange === 'function') {
      onIndexTypeChange(event.target.value);
    }
    // Notificar cambio de fecha al padre
    if ((event.target.name === 'startDate' || event.target.name === 'endDate') && typeof onDateChange === 'function') {
      onDateChange(event.target.name, event.target.value);
    }
  };

  const handleFileChange = (name, files) => {
    setFormData({ ...formData, [name]: files });
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            <TextField
              label="Start Date"
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              sx={{ margin: 1 }}
            />
            <TextField
              label="End Date"
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              InputLabelProps={{ shrink: true }}
              sx={{ margin: 1 }}
            />
          </Box>
        );
      case 1:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <InputLabel id="index-type-label">Index Type</InputLabel>
            <Select
              labelId="index-type-label"
              id="index-type-select"
              value={formData.indexType}
              onChange={handleChange}
              name="indexType"
              sx={{ width: 200, margin: 1 }}
            >
              <MenuItem value="NDVI">NDVI</MenuItem>
              <MenuItem value="EVI">EVI</MenuItem>
              <MenuItem value="GNDVI">GNDVI</MenuItem>
              <MenuItem value="NDMI">NDMI</MenuItem>
              <MenuItem value="MSI">MSI</MenuItem>
              <MenuItem value="BI">BI</MenuItem>
              <MenuItem value="SAVI">SAVI</MenuItem>
            </Select>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <DropzoneArea
              onChange={(files) => handleFileChange('aoiDataFiles', files)}
              acceptedFiles={['.zip']}
              dropzoneText="Área"
              maxFileSize={5000000}
              filesLimit={1}
              files={formData.aoiDataFiles}
              style={{ width: '100%', border: 'dashed', cursor: 'pointer', overflow: 'hidden' }}
            />
            {formData.aoiDataFiles && formData.aoiDataFiles.length > 0 && (
              <Box sx={{ mt: 2, width: '100%', textAlign: 'center' }}>
                <Typography variant="body2" color="primary">
                  Archivo subido: {formData.aoiDataFiles[0].name}
                </Typography>
              </Box>
            )}
          </Box>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Stepper activeStep={activeStep} sx={{ width: '80%', marginBottom: 2 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <div>
        {activeStep === steps.length ? (
          <React.Fragment>
            <Typography sx={{ mt: 2, mb: 1 }}>
              All steps completed - you're finished
            </Typography>
            <Button onClick={handleReset}>Reset</Button>
          </React.Fragment>
        ) : (
          <React.Fragment>
            {getStepContent(activeStep)}
            <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2, alignItems: 'center', justifyContent: 'center' }}>
              <Button disabled={activeStep === 0} onClick={handleBack}>
                Back
              </Button>
              <Button onClick={() => { if (activeStep === steps.length - 1) handleSubmit(); handleNext(); }}>
                {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </Box>
          </React.Fragment>
        )}
      </div>
    </Box>
  );
}