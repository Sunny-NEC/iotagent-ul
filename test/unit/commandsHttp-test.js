/*
 * Copyright 2016 Telefonica Investigación y Desarrollo, S.A.U
 *
 * This file is part of iotagent-ul
 *
 * iotagent-ul is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the License,
 * or (at your option) any later version.
 *
 * iotagent-ul is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with iotagent-ul.
 * If not, seehttp://www.gnu.org/licenses/.
 *
 * For those usages not covered by the GNU Affero General Public License
 * please contact with::[iot_support@tid.es]
 */

/* eslint-disable no-unused-vars */

const iotagentUl = require('../../');
const config = require('../config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const should = require('should');
const request = require('request');
const utils = require('../utils');
let mockedClientServer;
let contextBrokerMock;

describe('HTTP Transport binding: commands', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommand2.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/NGSI9/registerContext')
            .reply(200, utils.readExampleFile('./test/contextAvailabilityResponses/registerIoTAgent1Success.json'));

        contextBrokerMock
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

        mockedClientServer = nock('http://localhost:9876')
            .post('/command', 'MQTT_2@PING|data=22')
            .reply(200, 'MQTT_2@PING|1234567890');

        contextBrokerMock
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus2Success.json'));

        iotagentUl.start(config, function (error) {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();

        iotAgentLib.clearAll(function () {
            iotagentUl.stop(done);
        });
    });

    describe('When a command arrive to the Agent for a device with the HTTP_UL protocol', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
            method: 'POST',
            json: utils.readExampleFile('./test/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        it('should return a 200 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should reply with the appropriate command information', function (done) {
            request(commandOptions, function (error, response, body) {
                should.exist(body);
                done();
            });
        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                contextBrokerMock.done();
                done();
            });
        });

        it('should send the information to the configured device endpoint', function (done) {
            request(commandOptions, function (error, response, body) {
                mockedClientServer.done();
                done();
            });
        });
    });

    describe('When a command arrive to the Agent and the device answers with an error', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
            method: 'POST',
            json: utils.readExampleFile('./test/contextRequests/updateCommand1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function () {
            nock.cleanAll();

            mockedClientServer = nock('http://localhost:9876')
                .post('/command', 'MQTT_2@PING|data=22')
                .reply(500, 'MQTT_2@ping|ping ERROR, Command error');

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/updateStatusError2.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatusError2Success.json'));
        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a command arrive with a wrong endpoint', function () {
        const commandOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/v1/updateContext',
            method: 'POST',
            json: utils.readExampleFile('./test/contextRequests/updateCommandWrongEndpoint.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };
        const provisionWrongEndpoint = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionCommandWrongEndpoint.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            nock.cleanAll();

            contextBrokerMock = nock('http://192.168.1.1:1026')
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/NGSI9/registerContext')
                .reply(200, utils.readExampleFile('./test/contextAvailabilityResponses/registerIoTAgent1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus1Success.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', function (body) {
                    return body.contextElements['0'].attributes['0'].value === 'ERROR';
                })
                .reply(200, utils.readExampleFile('./test/contextResponses/updateStatus2Success.json'));

            request(provisionWrongEndpoint, function (error, response, body) {
                setTimeout(function () {
                    done();
                }, 50);
            });
        });

        it('should return a 200 OK without errors', function (done) {
            request(commandOptions, function (error, response, body) {
                should.not.exist(error);
                response.statusCode.should.equal(200);
                done();
            });
        });

        it('should update the status in the Context Broker', function (done) {
            request(commandOptions, function (error, response, body) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
});
