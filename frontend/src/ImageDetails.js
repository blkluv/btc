import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

import {
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
} from '@mui/material';

const ImageDetails = ({ navigate }) => {
    const { hash } = useParams();
    const [metadata, setMetadata] = useState(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const response = await fetch(`/data/assets/${hash}/meta.json`);
                const metadata = await response.json();
                setMetadata(metadata);
            } catch (error) {
                console.error('Error fetching image metadata:', error);
            }
        };

        fetchMetadata();
    }, [hash]);

    if (!metadata) {
        return <p>Loading...</p>;
    }

    const handleSetPfpClick = async () => {
        try {
            const response = await fetch('/api/profile/pfp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pfp: metadata.asset.path }),
            });

            if (response.ok) {
                console.log('Profile picture updated successfully');
            } else {
                const data = await response.json();
                console.error('Error updating profile picture:', data.message);
            }
        } catch (error) {
            console.error('Error updating profile picture:', error);
        }
    };

    const handleEditClick = async () => {
        navigate(`/image/edit/${metadata.asset.hash}`)
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ width: '50%', padding: '16px' }}>
                <img src={metadata.asset.path} alt={metadata.asset.originalName} style={{ width: '100%', height: 'auto' }} />
            </div>
            <div style={{ width: '50%', padding: '16px' }}>
                <h2>Metadata:</h2>
                <TableContainer>
                    <Table>
                        <TableBody>
                            <TableRow>
                                <TableCell>Title:</TableCell>
                                <TableCell>{metadata.asset.title}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Description:</TableCell>
                                <TableCell>{metadata.asset.description}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Tags:</TableCell>
                                <TableCell>{metadata.asset.tags}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Creator:</TableCell>
                                <TableCell>
                                    <Link to={`/profile/${metadata.asset.creator}`}>{metadata.asset.creator}</Link>
                                </TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>File size:</TableCell>
                                <TableCell>{metadata.asset.fileSize} bytes</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Image size:</TableCell>
                                <TableCell>{metadata.image.width} x {metadata.image.height}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell>Image format:</TableCell>
                                <TableCell>{metadata.image.format}</TableCell>
                            </TableRow>
                            {/* Add any other metadata you want to display */}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Button variant="contained" color="primary" onClick={handleSetPfpClick}>
                    Set as Profile Picture
                </Button>
                <p></p>
                <Button variant="contained" color="primary" onClick={handleEditClick}>
                    Edit Metadata
                </Button>
            </div>
        </div>
    );
};

export default ImageDetails;
