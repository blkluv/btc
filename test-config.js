const uuid = require('uuid');

const config = {
    name: 'testName',
    host: 'testHost',
    data: 'testData',
    assets: 'testData/assets',
    agents: 'testData/agents',
    certs: 'testData/certs',
    uploads: 'testData/uploads',
    dns_ns: uuid.v4(),
    block_link: 'http://block-link',
    txn_link: 'http://txn-link',
    ipfs_link: 'http://ipfs-link',
};

module.exports = config;
