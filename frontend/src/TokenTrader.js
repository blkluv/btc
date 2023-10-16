import React, { useEffect, useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    TableHead,
    Paper,
    TextField,
    Button,
    Modal,
} from '@mui/material';

const TokenTrader = ({ metadata, setRefreshKey }) => {
    const [nfts, setNfts] = useState(0);
    const [exchangeRate, setExchangeRate] = useState(null);
    const [charge, setCharge] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [invoiceUrl, setInvoiceUrl] = useState('');
    const [nftSale, setNftSale] = useState(null);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('/api/v1/rates');
                const xrates = await response.json();
                setExchangeRate(xrates.bitcoin.usd);

                const nfts = [];

                for (const xid of metadata.token.nfts) {
                    const response = await fetch(`/api/v1/asset/${xid}`);
                    const nft = await response.json();
                    nfts.push(nft);
                }

                setNfts(nfts);
            } catch (error) {
                console.error('Error:', error);
            }
        };

        fetchProfile();
    }, [metadata]);

    if (!metadata || !metadata.token || !nfts) {
        return;
    }

    const handleListClick = async (nft) => {
        try {
            const response = await fetch(`/api/v1/asset/${nft.xid}/list`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ price: nft.nft.newPrice }),
            });

            if (response.ok) {
                nft.nft.price = nft.nft.newPrice;
                setRefreshKey((prevKey) => prevKey + 1);
            } else {
                const data = await response.json();
                console.error('Error listing:', data.message);
                alert(data.message);
            }
        } catch (error) {
            console.error('Error listing:', error);
        }
    };

    // Create a new component for the table row
    function SellerTableRow({ nft }) {
        const [disableList, setDisableList] = useState(true);
        const [usdPrice, setUsdPrice] = useState(0);
        const [listed, setListed] = useState(false);

        const updatePrice = (price) => {
            const usdPrice = price * exchangeRate / 100000000;
            setUsdPrice(usdPrice);
        };

        useEffect(() => {
            updatePrice(nft.nft.price);
            setListed(nft.nft.price > 0);
        }, [nft]);

        return (
            <TableRow>
                <TableCell>{nft.asset.title}</TableCell>
                <TableCell align="right">${usdPrice.toFixed(2)}</TableCell>
                <TableCell>
                    <TextField
                        defaultValue={nft.nft.price}
                        type="number"
                        onChange={(event) => {
                            nft.nft.newPrice = parseInt(event.target.value, 10) || 0;
                            setDisableList(nft.nft.price === nft.nft.newPrice);
                            updatePrice(nft.nft.newPrice);
                        }}
                        inputProps={{ min: 0 }}
                        sx={{ width: '14ch', marginRight: 1 }}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {
                            handleListClick(nft);
                            setDisableList(true);
                            setListed(usdPrice > 0);
                        }}
                        disabled={disableList}
                    >
                        Save
                    </Button>
                </TableCell>
                <TableCell>{listed ? '✔' : ''}</TableCell>
            </TableRow>
        );
    };

    const handleBuyClick = async (nft) => {
        setNftSale(nft);

        try {
            const response = await fetch('/api/v1/charge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', },
                body: JSON.stringify({ description: 'buy NFT', amount: nft.nft.price }),
            });

            const chargeData = await response.json();

            if (chargeData.url) {
                setCharge(chargeData);
                setInvoiceUrl(chargeData.url);
                setModalOpen(true);
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const handleInvoiceClose = async () => {
        setModalOpen(false);

        try {
            const response = await fetch(`/api/v1/charge/${charge.id}`);
            const chargeData = await response.json();

            if (chargeData.paid) {
                const response = await fetch(`/api/v1/asset/${nftSale.xid}/buy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', },
                    body: JSON.stringify({ price: nftSale.nft.price, chargeId: charge.id }),
                });

                if (response.ok) {
                    setRefreshKey((prevKey) => prevKey + 1);
                } else {
                    const data = await response.json();
                    console.error('Error:', data.message);
                    alert(data.message);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        }
    };

    function BuyerTableRow({ nft }) {
        const [usdPrice, setUsdPrice] = useState(0);

        const updatePrice = (price) => {
            const usdPrice = price * exchangeRate / 100000000;
            setUsdPrice(usdPrice);
        };

        useEffect(() => {
            updatePrice(nft.nft.price);
        }, [nft]);

        return (
            <TableRow>
                <TableCell>{nft.asset.title}</TableCell>
                <TableCell align="right">${usdPrice.toFixed(2)}</TableCell>
                <TableCell>
                    <TextField
                        defaultValue={nft.nft.price}
                        type="number"
                        disabled={true}
                        sx={{ width: '14ch', marginRight: 1 }}
                    />
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => {
                            handleBuyClick(nft);
                        }}
                        disabled={nft.nft.price < 1}
                    >
                        Buy
                    </Button>
                </TableCell>
                <TableCell></TableCell>
            </TableRow>
        );
    };

    return (
        <>
            <TableContainer>
                <Table>
                    <TableBody>
                        <TableRow>
                            <TableCell>Title:</TableCell>
                            <TableCell>{metadata.asset.title}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Editions:</TableCell>
                            <TableCell>{metadata.token.editions > 1 ? metadata.token.editions : "1 of 1"}</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Exchange rate:</TableCell>
                            <TableCell>{exchangeRate} USD/BTC</TableCell>
                        </TableRow>
                        <TableRow>
                            <TableCell>Trade:</TableCell>
                            <TableCell>
                                <TableContainer component={Paper} style={{ maxHeight: '600px', overflow: 'auto' }}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell>Edition</TableCell>
                                                <TableCell>Price (USD)</TableCell>
                                                <TableCell>Price (sats)</TableCell>
                                                <TableCell>Listed</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {nfts.map((nft, index) => (
                                                nft.userIsOwner ? (<SellerTableRow key={index} nft={nft} />) : (<BuyerTableRow key={index} nft={nft} />)
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </TableContainer>
            <Modal
                open={modalOpen}
                onClose={() => handleInvoiceClose()}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{ backgroundColor: '#282c34', padding: '1em', width: '50vw', height: '100vh', overflow: 'auto' }}>
                    <iframe
                        src={invoiceUrl}
                        title="Invoice"
                        width="100%"
                        height="90%"
                        style={{ border: 'none' }}
                    />
                    <Button onClick={() => handleInvoiceClose()}>Close</Button>
                </div>
            </Modal>
        </>
    );
};

export default TokenTrader;
