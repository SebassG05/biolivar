import React from 'react';
import Dialog from '@material-ui/core/Dialog';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import { MuiThemeProvider, createTheme } from '@material-ui/core/styles';
import { GoogleLogin } from 'react-google-login'; 
import { validateEmail, validatePassword } from '../utils/validator';
import Snackbar from '@material-ui/core/Snackbar';
import MuiAlert from '@material-ui/lab/Alert';


const theme = createTheme({
    palette: {
        primary: {
            main: '#4CAF50', 
        },
        secondary: {
            main: '#388E3C', 
        },
    },
});

function Alert(props) {
    return <MuiAlert elevation={6} variant="filled" {...props} />;
}

class Register extends React.Component {
    state = {
        username: '',
        email: '',
        password: '',
        isSubmitting: false, 
        mode: 'register',
    };

    handleChange = (e) => {
        this.setState({ [e.target.name]: e.target.value });
    };

    // En el componente Register.jsx
    handleSubmit = async () => {
        const { username, email, password, mode } = this.state;
      
        // Enviar la solicitud de login o registro
        this.setState({ isSubmitting: true });
      
        const url = mode === 'register' 
            ? 'http://localhost:5000/api/auth/register' 
            : 'http://localhost:5000/api/auth/login'; 
      
        const body = mode === 'register' 
            ? JSON.stringify({ username, email, password })
            : JSON.stringify({ username, password });
      
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body,
        });
      
        const data = await response.json();
        
        if (response.ok) {
          // Si la respuesta es exitosa
          this.setState({
            snackbarOpen: true,
            snackbarMessage: mode === 'register' 
              ? 'User Registered Successfully! A verification email has been sent.' 
              : 'Login Successful!',
            snackbarSeverity: 'success',
          });
          this.props.onRegisterComplete(); // Función callback después del login o registro exitoso
        } else {
          // Si hay un error (por ejemplo, usuario no existe o credenciales incorrectas)
          this.setState({
            snackbarOpen: true,
            snackbarMessage: data.message || 'An error occurred',
            snackbarSeverity: 'error',
          });
        }
      
        this.setState({ isSubmitting: false });
      };
      
      
  
    

    handleGoogleSuccess = (response) => {
        console.log('Google Login Success:', response.profileObj);
      
        this.props.onRegisterComplete(); 
    };

    
    toggleMode = (mode) => {
        this.setState({ mode });
    };

    render() {
        return (
            <MuiThemeProvider theme={theme}>
                <Dialog
                    open={true}
                    disableBackdropClick={true} 
                    disableEscapeKeyDown={true} 
                >
                    <div
                        style={{
                            padding: 40,
                            minWidth: 500,
                            minHeight: 350, 
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {/* Logo en la parte superior */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <img
                        src="./static/assets/tepro_.png"
                        alt="Logo"
                        style={{ width: '150px', height: 'auto' }} 
                    />
                </div>

                        {/* Barra de selección entre Login y Register */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginBottom: 20,
                                width: '100%',
                                borderBottom: '2px solid #ddd',
                            }}
                        >
                            <Button
                                onClick={() => this.toggleMode('login')}
                                style={{
                                    flex: 1,
                                    textTransform: 'none',
                                    fontWeight:
                                        this.state.mode === 'login'
                                            ? 'bold'
                                            : 'normal',
                                    borderBottom:
                                        this.state.mode === 'login'
                                            ? '4px solid #4CAF50'
                                            : 'none',
                                    color:
                                        this.state.mode === 'login'
                                            ? '#4CAF50'
                                            : '#888',
                                    fontSize: '18px',
                                    padding: '10px 0',
                                }}
                            >
                                Login
                            </Button>
                            <Button
                                onClick={() => this.toggleMode('register')}
                                style={{
                                    flex: 1,
                                    textTransform: 'none',
                                    fontWeight:
                                        this.state.mode === 'register'
                                            ? 'bold'
                                            : 'normal',
                                    borderBottom:
                                        this.state.mode === 'register'
                                            ? '4px solid #4CAF50'
                                            : 'none',
                                    color:
                                        this.state.mode === 'register'
                                            ? '#4CAF50'
                                            : '#888',
                                    fontSize: '18px',
                                    padding: '10px 0',
                                }}
                            >
                                Register
                            </Button>
                        </div>

                        {/* Formulario de Register o Login */}
                        {this.state.mode === 'register' ? (
                            <>
                                <TextField
                                    name="username"
                                    label="Username"
                                    fullWidth
                                    margin="dense"
                                    onChange={this.handleChange}
                                    style={{ marginBottom: 20 }}
                                />
                                <TextField
                                    name="email"
                                    label="Email"
                                    fullWidth
                                    margin="dense"
                                    onChange={this.handleChange}
                                    style={{ marginBottom: 20 }}
                                />
                                <TextField
                                    name="password"
                                    label="Password"
                                    type="password"
                                    fullWidth
                                    margin="dense"
                                    onChange={this.handleChange}
                                    style={{ marginBottom: 20 }}
                                />
                                {/* Botón de Submit (Register) */}
                                <Button
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    onClick={this.handleSubmit}
                                    disabled={this.state.isSubmitting}
                                    style={{
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        marginTop: 20,
                                        padding: '12px 0',
                                        fontSize: '16px',
                                    }}
                                >
                                    {this.state.isSubmitting ? (
                                        <CircularProgress size={24} />
                                    ) : (
                                        'Register'
                                    )}
                                </Button>
                            </>
                        ) : (
                            <>
                                <TextField
                                    name="username"
                                    label="Username"
                                    fullWidth
                                    margin="dense"
                                    onChange={this.handleChange}
                                    style={{ marginBottom: 20 }}
                                />
                                <TextField
                                    name="password"
                                    label="Password"
                                    type="password"
                                    fullWidth
                                    margin="dense"
                                    onChange={this.handleChange}
                                    style={{ marginBottom: 20 }}
                                />
                                {/* Botón de Submit (Login) */}
                                <Button
                                    variant="contained"
                                    color="primary"
                                    fullWidth
                                    onClick={this.handleSubmit}
                                    disabled={this.state.isSubmitting}
                                    style={{
                                        backgroundColor: '#4CAF50',
                                        color: 'white',
                                        marginTop: 20,
                                        padding: '12px 0',
                                        fontSize: '16px',
                                    }}
                                >
                                    {this.state.isSubmitting ? (
                                        <CircularProgress size={24} />
                                    ) : (
                                        'Login'
                                    )}
                                </Button>
                            </>
                        )}

                        {/* Frase "Don't have an account? Sign up" solo en el modo Login */}
                        {this.state.mode === 'login' && (
                            <div style={{ marginTop: 20, textAlign: 'center' }}>
                                <span style={{ fontSize: '14px', color: '#888' }}>
                                    Don't have an account?{' '}
                                    <span
                                        onClick={() => this.toggleMode('register')}
                                        style={{
                                            color: '#4CAF50',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                        }}
                                    >
                                        Sign up
                                    </span>
                                </span>
                            </div>
                        )}
                        
                    {/* Línea con "OR" */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                margin: '20px 0',
                                width: '100%',
                            }}
                        >
                            <div
                                style={{
                                    flex: 1,
                                    height: '1px',
                                    backgroundColor: '#ddd',
                                }}
                            ></div>
                            <span
                                style={{
                                    margin: '0 10px',
                                    fontSize: '14px',
                                    color: '#888',
                                    fontWeight: 'bold',
                                }}
                            >
                                OR
                            </span>
                            <div
                                style={{
                                    flex: 1,
                                    height: '1px',
                                    backgroundColor: '#ddd',
                                }}
                            ></div>
                        </div>
                        
                        {/* Botón de Google */}
                        <div style={{ marginTop: 20, width: '100%', display: 'flex', justifyContent: 'center' }}>
                            <GoogleLogin
                                clientId="333024406750-iqtq85ch9drl7mola42a7192vfcm868d.apps.googleusercontent.com"
                                buttonText="Continue with Google"
                                onSuccess={this.handleGoogleSuccess}
                                onFailure={this.handleGoogleFailure}
                                cookiePolicy={'single_host_origin'}
                            />
                        </div>

                    </div>
                    <Snackbar
    open={this.state.snackbarOpen}
    autoHideDuration={3000}
    onClose={() => this.setState({ snackbarOpen: false })}
    anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
>
    <Alert
        onClose={() => this.setState({ snackbarOpen: false })}
        severity={this.state.snackbarSeverity}
    >
        {this.state.snackbarMessage}
    </Alert>
</Snackbar>
                </Dialog>
            </MuiThemeProvider>
        );
        
    }
}

export default Register;