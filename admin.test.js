const uuid = require('uuid');
const fs = require('fs');
const path = require('path');
const mockFs = require('mock-fs');

const admin = require('./admin');
const archiver = require('./archiver');
const utils = require('./utils');

const testConfig = {
    name: 'testName',
    host: 'testHost',
    data: 'testData',
    assets: 'testData/assets',
    agents: 'testData/agents',
    certs: 'testData/certs',
    dns_ns: uuid.v4(),
    block_link: 'http://block-link',
    txn_link: 'http://txn-link',
    ipfs_link: 'http://ipfs-link',
};

describe('getAdmin', () => {
    afterEach(() => {
        mockFs.restore();
    });

    it('should return a new admin object if meta.json does not exist', () => {
        mockFs({
            [testConfig.data]: {}  // Empty directory
        });

        const xid = utils.getMarketId(testConfig);
        const xid58 = utils.uuidToBase58(xid);

        const expectedAdmin = {
            name: testConfig.name,
            xid: xid,
            xid58: xid58,
            created: expect.any(String),
            updated: expect.any(String),
        };

        expect(admin.getAdmin(testConfig)).toEqual(expectedAdmin);
    });

    it('should return the content of meta.json if it exists', () => {
        const metaJson = { key: 'value' };
        mockFs({
            [testConfig.data]: {
                'meta.json': JSON.stringify(metaJson)
            }
        });

        expect(admin.getAdmin(testConfig)).toEqual(metaJson);
    });

    it('should add the content of CID to the returned object if CID exists', () => {
        const metaJson = { key: 'value' };
        const cidContent = 'cidContent';
        mockFs({
            [testConfig.data]: {
                'meta.json': JSON.stringify(metaJson),
                'CID': cidContent
            }
        });

        expect(admin.getAdmin(testConfig)).toEqual({ ...metaJson, cid: cidContent.trim() });
    });
});

describe('saveAdmin', () => {
    afterEach(() => {
        mockFs.restore();
    });

    it('should write admin data to meta.json and return the data', () => {
        const adminData = { key: 'value' };
        mockFs({
            [testConfig.data]: {}  // Empty directory
        });

        const expectedAdminData = {
            ...adminData,
            updated: expect.any(String)
        };

        const result = admin.saveAdmin(adminData, testConfig);

        expect(result).toEqual(expectedAdminData);

        const writtenData = JSON.parse(fs.readFileSync(path.join(testConfig.data, 'meta.json'), 'utf-8'));
        expect(writtenData).toEqual(expectedAdminData);
    });
});

describe('registerState', () => {

    afterEach(() => {
        mockFs.restore();
    });

    it('should save the admin state, register it, and save it again', async () => {
        const adminState = { key: 'value' };
        const txid = 'test-txid';
        mockFs({
            [testConfig.data]: {}  // Empty directory
        });

        // Mock archiver.register to return the mock pending value
        jest.spyOn(archiver, 'register').mockResolvedValue(txid);

        const expectedAdminState = {
            ...adminState,
            updated: expect.any(String),
            pending: txid
        };

        const result = await admin.registerState(adminState, testConfig);

        expect(result).toEqual(expectedAdminState);

        // Read the data that was written to meta.json and check that it matches the expected data
        const writtenData = JSON.parse(fs.readFileSync(path.join(testConfig.data, 'meta.json'), 'utf-8'));
        expect(writtenData).toEqual(expectedAdminState);
    });
});

describe('notarizeState', () => {

    afterEach(() => {
        mockFs.restore();
    });

    it('should save the admin state, register it, and save it again', async () => {
        const adminState = { key: 'value' };
        const txid = 'test-txid';
        mockFs({
            [testConfig.data]: {}  // Empty directory
        });

        // Mock archiver.register to return the mock pending value
        jest.spyOn(archiver, 'notarize').mockResolvedValue(txid);

        const expectedAdminState = {
            ...adminState,
            updated: expect.any(String),
            pending: txid
        };

        const result = await admin.notarizeState(adminState, testConfig);

        expect(result).toEqual(expectedAdminState);

        // Read the data that was written to meta.json and check that it matches the expected data
        const writtenData = JSON.parse(fs.readFileSync(path.join(testConfig.data, 'meta.json'), 'utf-8'));
        expect(writtenData).toEqual(expectedAdminState);
    });
});

describe('certifyState', () => {

    afterEach(() => {
        mockFs.restore();
    });

    it('should certify the admin state and save it', async () => {
        const adminState = { key: 'value', pending: 'mockPending' };
        const cert = { xid: 'mockXid' };
        mockFs({
            [testConfig.data]: {},  // Empty directory
            [testConfig.certs]: {}  // Empty directory
        });

        // Mock archiver.certify to return the mock cert
        jest.spyOn(archiver, 'certify').mockResolvedValue(cert);

        const expectedAdminState = {
            ...adminState,
            latest: cert.xid,
            pending: null,
            updated: expect.any(String)
        };

        const result = await admin.certifyState(adminState, testConfig);

        expect(result).toEqual(expectedAdminState);

        // Read the data that was written to meta.json and check that it matches the expected data
        const certFile = path.join(testConfig.certs, cert.xid, 'meta.json');
        const writtenData = JSON.parse(fs.readFileSync(certFile, 'utf-8'));
        expect(writtenData).toEqual(cert);
    });
});

describe('getWalletInfo', () => {

    it('should return walletinfo from archiver', async () => {
        const walletinfo = { key: 'value' };

        // Mock archiver.certify to return the mock walletinfo
        jest.spyOn(archiver, 'walletinfo').mockResolvedValue(walletinfo);

        const result = await admin.getWalletInfo();

        expect(result).toEqual(walletinfo);
    });
});

describe('getAuditLog', () => {

    afterEach(() => {
        mockFs.restore();
    });

    it('should return the transaction log for the specified user', () => {
        const log = [
            { event: 'event1' },
            { event: 'event2' },
        ];

        // Mock the file system
        mockFs({
            [testConfig.data]: {
                'auditlog.jsonl': log.map(JSON.stringify).join('\n'),
            }
        });

        const result = admin.getAuditLog(testConfig);

        expect(result).toEqual(log.reverse());
    });

    it('should return an empty array if the transaction log does not exist', () => {
        // Mock the file system
        mockFs({
            [testConfig.agents]: {}  // Empty directory
        });

        const result = admin.getAuditLog(testConfig);

        expect(result).toEqual([]);
    });
});

describe('saveAuditLog', () => {

    afterEach(() => {
        mockFs.restore();
    });

    it('should append the record to the transaction log', () => {
        const record = { event: 'event1' };

        // Mock the file system
        mockFs({
            [testConfig.data]: {
                'auditlog.jsonl': '',
            },
        });

        admin.saveAuditLog(record, testConfig);

        // Read the data that was written to auditlog.jsonl and check that it matches the expected data
        const jsonlPath = path.join(testConfig.data, 'auditlog.jsonl');
        const writtenData = fs.readFileSync(jsonlPath, 'utf-8');
        const writtenRecord = JSON.parse(writtenData.trim());
        expect(writtenRecord).toEqual({ ...record, time: expect.any(String) });
    });
});
