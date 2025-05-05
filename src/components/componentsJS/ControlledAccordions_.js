import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Backdrop, CircularProgress, InputLabel, Select, TextField, FormControl, MenuItem, Grid } from '@material-ui/core';
import Accordion from '@material-ui/core/Accordion';
import { DropzoneArea } from 'material-ui-dropzone';
import { AttachFile, Description, PictureAsPdf, Theaters } from '@material-ui/icons';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import Typography from '@material-ui/core/Typography';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import InfoOutlined from '@material-ui/icons/InfoOutlined';
import Tooltip from '@material-ui/core/Tooltip';
import emitter from '@utils/events.utils';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
  },
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
    width: '100%',
  },
  dateInput: {
    width: '100%',
  },
  backdrop: {
    zIndex: theme.zIndex.drawer + 1,
    color: '#fff',
  },
  progressText: {
    marginLeft: theme.spacing(2),
  },
}));

const ControlledAccordions = forwardRef(function ControlledAccordions({ onSubmit, onIndexTypeChange }, ref) {
  const classes = useStyles();
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    startDate: "2000-04-14",
    endDate: "2024-05-14",
    indexType: 'NDVI',
    aoiDataFiles: []
  });
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    let timerInterval;
    if (loading) {
      timerInterval = setInterval(() => {
        setTimer((prevTimer) => prevTimer + 1);
      }, 1000);
    } else {
      clearInterval(timerInterval);
    }

    return () => clearInterval(timerInterval);
  }, [loading]);

  useEffect(() => {
    // Cargar fechas guardadas en localStorage al iniciar
    const savedStartDate = localStorage.getItem('startDate');
    const savedEndDate = localStorage.getItem('endDate');
    setFormData(prev => ({
      ...prev,
      startDate: savedStartDate || prev.startDate,
      endDate: savedEndDate || prev.endDate
    }));
  }, []);

  const handleChangeExp = (panel) => (event, isExpanded) => {
    setExpanded(isExpanded ? panel : false);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Guardar fechas en localStorage si corresponde
    if (name === 'startDate' || name === 'endDate') {
      localStorage.setItem(name, value);
    }
    // Notificar cambio de índice al padre
    if (name === 'indexType' && typeof onIndexTypeChange === 'function') {
      onIndexTypeChange(value);
    }
  };

  const handlePreviewIcon = (fileObject, classes) => {
    const { type } = fileObject.file;
    const iconProps = {
      className: classes.image,
    };

    if (type.startsWith("video/")) return <Theaters {...iconProps} />;

    switch (type) {
      case "application/msword":
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return <Description {...iconProps} />;
      case "application/pdf":
        return <PictureAsPdf {...iconProps} />;
      default:
        return <AttachFile {...iconProps} />;
    }
  };

  const handleFileChange = (name, files) => {
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          // Handle file processing
        } catch (error) {
          console.error("Error processing shapefile", error);
        }
      };
      reader.readAsArrayBuffer(files[0]);
    }
    setFormData(prev => ({
      ...prev,
      [name]: files
    }));
  };

  const handleSubmit = async () => {
    // Validación previa antes de enviar
    if (!formData.aoiDataFiles || formData.aoiDataFiles.length === 0) {
      emitter.emit('showSnackbar', 'error', 'Debes subir un archivo de área de interés (.zip)');
      return;
    }
    if (!formData.indexType) {
      emitter.emit('showSnackbar', 'error', 'Debes seleccionar un índice de vegetación');
      return;
    }
    if (!formData.startDate || !formData.endDate) {
      emitter.emit('showSnackbar', 'error', 'Debes seleccionar fechas de inicio y fin');
      return;
    }
    try {
      setLoading(true);
      setTimer(0);
      const data = new FormData();

      data.append('aoiDataFiles', formData.aoiDataFiles[0]);
      data.append('indexType', formData.indexType);
      data.append('startDate', formData.startDate);
      data.append('endDate', formData.endDate);

      const apiUrl = 'http://127.0.0.1:500/api/vegetation_index_change_inspector'; // Use local server
      console.log('Calling API:', apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: data,
      });

      const result = await response.json();
      console.log(result);
      if (result && result.success && Array.isArray(result.output)) {
        console.log('Data sent successfully', result.output);
        onSubmit(result.output);
        setLoading(false);
        emitter.emit('closeAllController');
        emitter.emit('openLayerController');
        return true;
      } else if (result && result.error) {
        setLoading(false);
        emitter.emit('showSnackbar', 'error', `Error: '${result.error}'`);
        return false;
      } else {
        setLoading(false);
        emitter.emit('showSnackbar', 'error', 'Unexpected response from server.');
        return false;
      }

    } catch (error) {
      setLoading(false);
      emitter.emit('showSnackbar', 'error', `Error: '${error}'`);
      console.error('Failed to send data', error);
    }
  };

  useImperativeHandle(ref, () => ({
    submit: handleSubmit
  }));

  return (
    <div className={classes.root}>
      <Accordion expanded={expanded === 'panel1'} onChange={handleChangeExp('panel1')}>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1bh-content"
          id="panel1bh-header"
        >
          <Typography className={classes.heading}>Selecciona un índice de vegetación</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <DropzoneArea
            onChange={(files) => handleFileChange('aoiDataFiles', files)}
            acceptedFiles={['.zip']}
            dropzoneText="Área de interés"
            maxFileSize={5000000}
            filesLimit={1}
            getPreviewIcon={handlePreviewIcon}
          />
        </AccordionDetails>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha de inicio"
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                className={classes.dateInput}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha fin"
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                className={classes.dateInput}
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={12}>
              <FormControl className={classes.formControl}>
                <Select
                  labelId="index-type-label"
                  id="index-type-select"
                  value={formData.indexType}
                  onChange={handleChange}
                  name="indexType"
                >
                  <MenuItem value="NDVI">NDVI</MenuItem>
                  <MenuItem value="EVI">EVI</MenuItem>
                  <MenuItem value="SAVI">SAVI</MenuItem>
                  <MenuItem value="MSI">MSI</MenuItem>
                  <MenuItem value="NDMI">NDMI</MenuItem>
                  <MenuItem value="NBR">NBR</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
      <Backdrop className={classes.backdrop} open={loading}>
        <CircularProgress color="inherit" />
        <Typography variant="h6" className={classes.progressText}>
          Loading... {timer}s
        </Typography>
      </Backdrop>
    </div>
  );
});

export default ControlledAccordions;