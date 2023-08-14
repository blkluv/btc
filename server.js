const express = require('express');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const passport = require('passport');
const LnurlAuth = require('passport-lnurl-auth');
const session = require('express-session');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { requestInvoice } = require('lnurl-pay');

const { createCharge, checkCharge, sendPayment } = require('./satspay');
const {
  getAdmin,
  saveAdmin,
  getAgentFromKey,
  getAgent,
  saveAgent,
  allAssets,
  allAgents,
  verifyAsset,
  fixAsset,
  pinAsset,
  verifyAgent,
  fixAgent,
  getAgentAndCollections,
  getCollection,
  getAsset,
  commitAsset,
  createAssets,
  transferAsset,
  createToken,
  createCollection,
  saveCollection,
  removeCollection,
  isOwner,
  getAllAgents,
  integrityCheck,
} = require('./xidb');

const app = express();

dotenv.config();

const config = {
  host: process.env.ARTX_HOST || 'localhost',
  port: process.env.ARTX_PORT || 5000,
  depositAddress: process.env.TXN_FEE_DEPOSIT,
  txnFeeRate: process.env.TXN_FEE_RATE || 0.025,
  storageRate: process.env.STORAGE_RATE || 0.001,
  editionRate: process.env.EDITION_RATE || 100,
  data: 'data',
  uploads: 'data/uploads',
  assets: 'data/assets',
  agents: 'data/agents',
  id: 'data/id',
};

config.url = 'http://' + config.host + ':' + config.port;

const ensureFolderExists = (folderPath) => {
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
};

ensureFolderExists(config.data);
ensureFolderExists(config.uploads);
ensureFolderExists(config.assets);
ensureFolderExists(config.agents);
ensureFolderExists(config.id);

app.use(session({
  secret: 'Satoshi',
  resave: true,
  saveUninitialized: true,
}));

app.use(morgan('dev'));
app.use(express.json());

// Serve the React frontend
app.use(express.static(path.join(__dirname, 'frontend/build')));

// Serve the assets
app.use('/data', express.static(path.join(__dirname, config.data)));

app.get('/api/v1/data', (req, res) => {
  res.json({ message: 'Welcome to the ArtX!' });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploads);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

app.use(passport.initialize());
app.use(passport.session());

const map = {
  user: new Map(),
};

passport.serializeUser(function (user, done) {
  done(null, user.key);
});

passport.deserializeUser(function (key, done) {
  done(null, map.user.get(key) || null);
});

passport.use(new LnurlAuth.Strategy(async function (linkingPublicKey, done) {
  let user = map.user.get(linkingPublicKey);
  if (!user) {
    const agentData = await getAgentFromKey(linkingPublicKey);
    console.log(`passport ${linkingPublicKey} ${agentData.xid}`);
    user = { key: linkingPublicKey, xid: agentData.xid, };
    map.user.set(linkingPublicKey, user);
  }
  done(null, user);
}));

app.use(passport.authenticate('lnurl-auth'));

app.get('/login',
  function (req, res, next) {
    if (req.user) {
      // Already authenticated.
      return res.redirect('/profile');
    }
    next();
  },
  new LnurlAuth.Middleware({
    callbackUrl: config.url + '/login',
    cancelUrl: config.url
  })
);

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      res.status(500).json({ message: 'Error logging out' });
    } else {
      res.json({ message: 'Logged out successfully' });
    }
  });
});

app.get('/check-auth/:xid?', async (req, res) => {
  if (req.isAuthenticated()) {
    const userId = req.params.xid;
    const admin = await getAdmin();
    const isAdmin = req.user.xid === admin.owner;

    if (userId) {
      res.json({
        message: 'Authenticated',
        sameId: req.user.xid === userId,
        isAdmin: isAdmin,
      });
    } else {
      res.json({
        message: 'Authenticated',
        isAdmin: isAdmin,
      });
    }
  } else {
    res.json({ message: 'Unauthorized' });
  }
});

const upload = multer({ storage });

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
}

app.get('/api/v1/rates', async (req, res) => {
  try {
    const xrResp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const xrData = await xrResp.json();
    xrData.storageRate = config.storageRate;
    xrData.editionRate = config.editionRate;
    res.json(xrData);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error fetching exchange rates' });
  }
});

app.get('/api/v1/licenses', async (req, res) => {
  licenses = {
    "CC BY": "https://creativecommons.org/licenses/by/4.0/",
    "CC BY-SA": "https://creativecommons.org/licenses/by-sa/4.0/",
    "CC BY-NC": "https://creativecommons.org/licenses/by-nc/4.0/",
    "CC BY-ND": "https://creativecommons.org/licenses/by-nd/4.0/",
    "CC BY-NC-SA": "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    "CC BY-NC-ND": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
    "CC0": "https://creativecommons.org/publicdomain/zero/1.0/",
  };

  res.json(licenses);
});

app.get('/api/v1/admin', ensureAuthenticated, async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (adminData.owner && adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json(adminData);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(404).json({ message: 'Asset not found' });
  }
});

app.get('/api/v1/admin/claim', ensureAuthenticated, async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (adminData.owner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    adminData.owner = req.user.xid;
    const savedAdmin = await saveAdmin(adminData);
    res.json(savedAdmin);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(404).json({ message: 'Asset not found' });
  }
});

app.get('/api/v1/admin/save', ensureAuthenticated, async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const savedAdmin = await saveAdmin(adminData);
    res.json(savedAdmin);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(404).json({ message: 'Asset not found' });
  }
});

app.get('/api/v1/admin/assets', ensureAuthenticated, async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json(allAssets());
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ message: 'Assets not found' });
  }
});

app.get('/api/v1/admin/agents', ensureAuthenticated, async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json(allAgents());
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ message: 'Agents not found' });
  }
});

app.get('/api/v1/admin/verify/asset/:xid', async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const verify = await verifyAsset(req.params.xid);
    res.json(verify);
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ error: 'Asset cannot be verified' });
  }
});

app.get('/api/v1/admin/fix/asset/:xid', async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const verify = await fixAsset(req.params.xid);
    res.json(verify);
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ error: 'Asset cannot be fixed' });
  }
});

app.get('/api/v1/admin/verify/agent/:xid', async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const verify = await verifyAgent(req.params.xid);
    res.json(verify);
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ error: 'Agent cannot be verified' });
  }
});

app.get('/api/v1/admin/fix/agent/:xid', async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const verify = await fixAgent(req.params.xid);
    res.json(verify);
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ error: 'Asset cannot be fixed' });
  }
});

app.get('/api/v1/admin/pin/asset/:xid', async (req, res) => {
  try {
    const adminData = await getAdmin();

    if (!adminData.owner || adminData.owner !== req.user.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const pin = await pinAsset(req.params.xid);
    res.json(pin);
  } catch (error) {
    console.error('Error:', error);
    res.status(404).json({ error: `Asset cannot be pinned ${error}` });
  }
});

app.get('/api/v1/asset/:xid', async (req, res) => {
  try {
    const assetData = await getAsset(req.params.xid);
    assetData.userIsOwner = await isOwner(assetData, req.user?.xid);
    res.json(assetData);
  } catch (error) {
    console.error('Error reading metadata:', error);
    res.status(404).json({ message: 'Asset not found' });
  }
});

app.patch('/api/v1/asset/:xid', ensureAuthenticated, async (req, res) => {
  const { xid } = req.params;
  const { title, collection } = req.body;
  const userId = req.user.xid;

  try {
    let assetData = await getAsset(xid);

    if (userId != assetData.asset.owner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (assetData.mint) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (title) {
      assetData.asset.title = title;
    }

    if (collection) {
      // TBD verify valid collection
      assetData.asset.collection = collection;
    }

    await commitAsset(assetData);

    res.json({ message: 'Metadata updated successfully' });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ message: 'Error updating metadata' });
  }
});

app.post('/api/v1/asset/:xid/mint', ensureAuthenticated, async (req, res) => {
  try {
    const xid = req.params.xid;
    const { editions, license, royalty } = req.body;
    const userId = req.user.xid;
    const assetData = await getAsset(xid);

    if (assetData.asset.owner != userId) {
      console.log('mint unauthorized');
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (assetData.token) {
      console.log('already minted');
      return res.status(500).json({ message: 'Error' });
    }

    await createToken(userId, xid, editions, license, royalty / 100);
    res.json({ message: 'Success' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/api/v1/asset/:xid/list', ensureAuthenticated, async (req, res) => {
  try {
    const xid = req.params.xid;
    const { price } = req.body;
    const userId = req.user.xid;
    const assetData = await getAsset(xid);

    console.log(`list ${xid} with price=${price}`);

    if (assetData.asset.owner != userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!assetData.nft) {
      res.status(500).json({ message: 'Error' });
    }

    const newPrice = parseInt(price, 10);

    if (newPrice !== assetData.nft.price) {
      assetData.nft.price = newPrice;
      await commitAsset(assetData, 'Listed');
    }

    res.json({ ok: true, message: 'Success' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error' });
  }
});

app.post('/api/v1/asset/:xid/buy', ensureAuthenticated, async (req, res) => {
  try {
    const xid = req.params.xid;
    const userId = req.user.xid;
    const { chargeId } = req.body;

    const assetData = await getAsset(xid);

    if (!assetData.nft) {
      return res.status(500).json({ message: 'Error' });
    }

    if (assetData.asset.owner == userId) {
      return res.status(500).json({ message: "Already owned" });
    }

    const buyer = await getAgent(userId);
    const seller = await getAgent(assetData.asset.owner);

    // TBD associate this charge with this asset for validation
    const chargeData = await checkCharge(chargeId);

    if (!chargeData.paid) {
      console.log(`charge ${chargeId} not paid`);
      return res.status(500).json({ message: 'Error' });
    }

    const price = chargeData.amount;

    if (price != assetData.nft.price) {
      console.log(`price mismatch between charge ${price} and nft ${assetData.nft.price}`);
      return res.status(500).json({ message: 'Error' });
    }

    await transferAsset(xid, userId);

    const tokenData = await getAsset(assetData.nft.asset);
    const assetName = `"${tokenData.asset.title}" (${assetData.asset.title})`;
    console.log(`audit: ${buyer.name} buying ${assetName} for ${price} from ${seller.name}`);

    const royaltyRate = tokenData.token?.royalty || 0;
    let royalty = 0;

    if (tokenData.asset.owner !== seller.xid) {
      const creator = await getAgent(tokenData.asset.owner);
      royalty = Math.round(price * royaltyRate);

      if (creator.deposit && royalty > 0) {
        sendPayment(creator.deposit, royalty, `royalty for asset ${assetName}`);
        console.log(`audit: royalty ${royalty} to ${creator.deposit}`);
      }
    }

    const txnFee = Math.round(config.txnFeeRate * price);
    const payout = price - royalty - txnFee;

    if (seller.deposit) {
      sendPayment(seller.deposit, payout, `sale of asset ${assetName}`);
      console.log(`audit: payout ${payout} to ${seller.deposit}`);
    }

    if (txnFee > 0 && config.depositAddress) {
      sendPayment(config.depositAddress, txnFee, `txn fee for asset ${assetName}`);
      console.log(`audit: txn fee ${txnFee} to ${config.depositAddress}`);
    }

    res.json({ ok: true, message: 'Success' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Error' });
  }
});

app.get('/api/v1/profiles/', async (req, res) => {
  try {
    const profiles = await getAllAgents();
    res.json(profiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while reading agent profiles.' });
  }
});

app.get('/api/v1/profile/:xid?', async (req, res) => {
  const profileId = req.params.xid;
  const userId = req.user?.xid;

  try {
    const agentData = await getAgentAndCollections(profileId, userId);

    if (agentData) {
      agentData.collections = Object.values(agentData.collections);
      agentData.isUser = (userId === agentData.xid);
      res.json(agentData);
    } else {
      res.status(404).json({ message: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile data:', error);
    res.status(500).json({ message: 'Error fetching profile data' });
  }
});

app.patch('/api/v1/profile/', ensureAuthenticated, async (req, res) => {
  try {
    const { name, tagline, pfp, deposit, collections, links } = req.body;
    const userId = req.user.xid;

    const agentData = await getAgent(userId);

    if (userId != agentData.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (name) {
      agentData.name = name;
    }

    if (tagline !== undefined) {
      agentData.tagline = tagline;
    }

    if (pfp) {
      agentData.pfp = pfp;
    }

    if (deposit) {
      agentData.deposit = deposit;
    }

    if (collections) {
      // TBD verify collections
      agentData.collections = collections;
    }

    if (links) {
      agentData.links = links;
    }

    await saveAgent(agentData);
    res.json({ message: 'Metadata updated successfully' });
  } catch (error) {
    console.error('Error updating metadata:', error);
    res.status(500).json({ message: 'Error updating metadata' });
  }
});

app.post('/api/v1/profile/:xid/invoice', async (req, res) => {
  const profileId = req.params.xid;
  const { amount } = req.body;

  try {
    const agentData = await getAgent(profileId);

    if (agentData) {
      const { invoice } = await requestInvoice({
        lnUrlOrAddress: agentData.deposit,
        tokens: amount,
      });
      res.json({ invoice: invoice });
    } else {
      res.status(404).json({ message: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Error creating invoice' });
  }
});

app.get('/api/v1/collections/', async (req, res) => {
  try {
    const userId = req.user?.xid;
    const collection = await createCollection(userId, "new");
    res.json(collection);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.get('/api/v1/collections/:xid', async (req, res) => {
  try {
    const userId = req.user?.xid;
    const collection = await getCollection(req.params.xid, userId);
    res.json(collection);
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.post('/api/v1/collections/:xid', ensureAuthenticated, async (req, res) => {
  try {
    const collection = req.body;

    if (req.user.xid != collection.asset.owner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (req.params.xid != collection.xid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const ok = await saveCollection(collection);
    res.json({ message: 'Collection updated successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.patch('/api/v1/collections/:xid', ensureAuthenticated, async (req, res) => {
  try {
    const { thumbnail } = req.body;
    const collection = await getAsset(req.params.xid);

    if (req.user.xid != collection.asset.owner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (thumbnail) {
      collection.collection.thumbnail = thumbnail;
    }

    await commitAsset(collection);
    res.json({ message: 'Collection updated successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.delete('/api/v1/collections/:xid', ensureAuthenticated, async (req, res) => {
  try {
    const userId = req.user?.xid;
    const collection = await getCollection(req.params.xid, userId);

    if (req.user.xid != collection.asset.owner) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (collection.collection.assets.length > 0) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    await removeCollection(collection);
    res.json({ message: 'Collection removed successfully' });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ error: 'An error occurred while processing the request.' });
  }
});

app.post('/api/v1/collections/:xid/upload', ensureAuthenticated, upload.array('images', 100), async (req, res) => {
  try {
    const collectionId = req.params.xid;

    await createAssets(req.user.xid, req.files, collectionId);

    // Send a success response after processing all files
    res.status(200).json({ success: true, message: 'Files uploaded successfully' });
  } catch (error) {
    console.error('Error processing files:', error);
    res.status(500).json({ success: false, message: 'Error processing files' });
  }
});

app.get('/api/v1/charge/:chargeId', ensureAuthenticated, async (req, res) => {
  try {
    const chargeData = await checkCharge(req.params.chargeId);

    res.status(200).json({
      id: chargeData.id,
      description: chargeData.description,
      amount: chargeData.amount,
      paid: chargeData.paid,
      time_elapsed: chargeData.time_elapsed,
      time_left: chargeData.time_left,
    });
  }
  catch (error) {
    console.error('Error:', error);
    res.status(500).json({ ok: false, message: 'Error' });
  }
});

app.post('/api/v1/charge', ensureAuthenticated, async (req, res) => {
  try {
    const { description, amount } = req.body;
    const chargeData = await createCharge(description, amount);

    res.status(200).json({
      ok: true,
      id: chargeData.id,
      url: chargeData.url,
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ ok: false, message: 'Error' });
  }
});

app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'frontend/build', 'index.html'));
  } else {
    console.warn(`Warning: Unhandled API endpoint - ${req.method} ${req.originalUrl}`);
    res.status(404).json({ message: 'Endpoint not found' });
  }
});

integrityCheck().then(() => {
  app.listen(config.port, () => {
    console.log(`ArtX server running on ${config.host}:${config.port}`);
  });
}).catch((error) => {
  console.error('Failed to start the server:', error);
});
