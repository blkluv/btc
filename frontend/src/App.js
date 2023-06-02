import React, { useState, useEffect } from 'react';
import './App.css';
import ImageGrid from './ImageGrid';
import BuildTime from './BuildTime';
import AuthButton from './AuthButton';

function App() {
  const [message, setMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/check-auth');
      const data = await response.json();
      if (data.message === 'Authenticated') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Error fetching authentication status:', error);
      setIsAuthenticated(false);
    }
  };

  const handleLogin = () => {
    window.location.href = '/login';
  };

  const handleLogout = async () => {
    await fetch('/logout', { method: 'GET', credentials: 'include' });
    checkAuthStatus();
  };

  const handleUpload = async (event) => {
    const file = event.target.files[0];
    const formData = new FormData();
    formData.append('image', file);

    try {
      setUploadStatus('Image uploading...');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setRefreshKey((prevKey) => prevKey + 1); // Increment refreshKey after a successful upload
        setUploadStatus('Image uploaded successfully');
      } else {
        setUploadStatus('Image upload failed');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setUploadStatus('Image upload failed');
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    fetch('/api/data')
      .then((response) => response.json())
      .then((data) => setMessage(data.message));
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <BuildTime />
        <AuthButton isAuthenticated={isAuthenticated} onLogin={handleLogin} onLogout={handleLogout} />
        <h1>{message}</h1>
        {isAuthenticated ? (
          <>
            <input type="file" onChange={handleUpload} />
            <p>{uploadStatus}</p>
            <ImageGrid refreshKey={refreshKey} />
          </>
        ) : (
          <p>Please log in to view and upload images.</p>
        )}
      </header>
    </div>
  );
}

export default App;
