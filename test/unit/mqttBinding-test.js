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

const iotagentMqtt = require('../../');
const mqtt = require('mqtt');
const config = require('../config-test.js');
const nock = require('nock');
const iotAgentLib = require('iotagent-node-lib');
const async = require('async');
const request = require('request');
const utils = require('../utils');
let contextBrokerMock;
let contextBrokerUnprovMock;
let mqttClient;

describe('MQTT Transport binding: measures', function () {
    beforeEach(function (done) {
        const provisionOptions = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionDevice1.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        nock.cleanAll();

        mqttClient = mqtt.connect('mqtt://' + config.mqtt.host, {
            keepalive: 0,
            connectTimeout: 60 * 60 * 1000
        });

        contextBrokerMock = nock('http://192.168.1.1:1026')
            .matchHeader('fiware-service', 'smartgondor')
            .matchHeader('fiware-servicepath', '/gardens')
            .post('/v1/updateContext')
            .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

        iotagentMqtt.start(config, function () {
            request(provisionOptions, function (error, response, body) {
                done();
            });
        });
    });

    afterEach(function (done) {
        nock.cleanAll();
        mqttClient.end();

        async.series([iotAgentLib.clearAll, iotagentMqtt.stop], done);
    });

    describe('When a new single measure arrives to a Device topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs/a', '23', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute (without leading slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs/a', '23', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new measure arrives for an unprovisioned Device', function () {
        const groupCreation = {
            url: 'http://localhost:4061/iot/services',
            method: 'POST',
            json: utils.readExampleFile('./test/groupProvisioning/provisionFullGroup.json'),
            headers: {
                'fiware-service': 'TestService',
                'fiware-servicepath': '/testingPath'
            }
        };

        beforeEach(function (done) {
            contextBrokerUnprovMock = nock('http://unexistentHost:1026')
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerUnprovMock
                .matchHeader('fiware-service', 'TestService')
                .matchHeader('fiware-servicepath', '/testingPath')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/unprovisionedMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/unprovisionedSuccess.json'));

            request(groupCreation, function (error, response, body) {
                done();
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute', function (done) {
            mqttClient.publish('/ul/80K09H324HV8732/MQTT_UNPROVISIONED/attrs/a', '23', null, function (error) {
                setTimeout(function () {
                    contextBrokerUnprovMock.done();
                    done();
                }, 100);
            });
        });

        it('should send a new update context request to the Context Broker with just that attribute (without leading slash)', function (done) {
            mqttClient.publish('ul/80K09H324HV8732/MQTT_UNPROVISIONED/attrs/a', '23', null, function (error) {
                setTimeout(function () {
                    contextBrokerUnprovMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives to a Device topic with one measure', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should send a single update context request with all the attributes', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs', 'a|23', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send a single update context request with all the attributes (without leadin slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs', 'a|23', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a new multiple measure arrives to a Device topic with a faulty payload', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));
        });

        it('should silently ignore the error (without crashing)', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs', 'notAULPayload ', null, function (error) {
                setTimeout(function () {
                    done();
                }, 100);
            });
        });
        it('should silently ignore the error (without crashing) (without leadin slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs', 'notAULPayload ', null, function (error) {
                setTimeout(function () {
                    done();
                }, 100);
            });
        });
    });

    describe('When single message with multiple measures arrive to a Device topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        it('should send one update context per measure group to the Contet Broker', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs', 'a|23|b|98', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send one update context per measure group to the Contet Broker (without leadin slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs', 'a|23|b|98', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a message with multiple measure groups arrives to a Device topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/singleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/singleMeasureSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/secondSingleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/secondSingleMeasureSuccess.json'));
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs', 'a|23#b|98', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute (without leading slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs', 'a|23#b|98', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });
    describe('When multiple groups of measures arrive, with multiple attributes, to a Device topic', function () {
        beforeEach(function () {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/multipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));

            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/secondMultipleMeasure.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/multipleMeasuresSuccess.json'));
        });

        it('should send a two update context requests to the Context Broker one with each attribute', function (done) {
            mqttClient.publish('/ul/1234/MQTT_2/attrs', 'a|23|b|98#a|16|b|34', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
        it('should send a two update context requests to the Context Broker one with each attribute (without leading slash)', function (done) {
            mqttClient.publish('ul/1234/MQTT_2/attrs', 'a|23|b|98#a|16|b|34', null, function (error) {
                setTimeout(function () {
                    contextBrokerMock.done();
                    done();
                }, 100);
            });
        });
    });

    describe('When a measure with a timestamp arrives with an alias to TimeInstant', function () {
        const provisionProduction = {
            url: 'http://localhost:' + config.iota.server.port + '/iot/devices',
            method: 'POST',
            json: utils.readExampleFile('./test/deviceProvisioning/provisionTimeInstant.json'),
            headers: {
                'fiware-service': 'smartgondor',
                'fiware-servicepath': '/gardens'
            }
        };

        beforeEach(function (done) {
            contextBrokerMock
                .matchHeader('fiware-service', 'smartgondor')
                .matchHeader('fiware-servicepath', '/gardens')
                .post('/v1/updateContext')
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'))
                .post('/v1/updateContext', utils.readExampleFile('./test/contextRequests/timeInstantDuplicated.json'))
                .reply(200, utils.readExampleFile('./test/contextResponses/timeInstantDuplicatedSuccess.json'));

            config.iota.timestamp = true;

            nock('http://localhost:8082').post('/protocols').reply(200, {});

            iotagentMqtt.stop(function () {
                iotagentMqtt.start(config, function (error) {
                    request(provisionProduction, function (error, response, body) {
                        done();
                    });
                });
            });
        });

        afterEach(function () {
            config.iota.timestamp = false;
        });

        it('should use the provided TimeInstant as the general timestamp for the measures', function (done) {
            mqttClient.publish(
                '/ul/1234/timestampedDevice/attrs',
                'tmp|24.4|tt|2016-09-26T12:19:26.476659Z',
                null,
                function (error) {
                    setTimeout(function () {
                        contextBrokerMock.done();
                        done();
                    }, 100);
                }
            );
        });
        it('should use the provided TimeInstant as the general timestamp for the measures (without leading slash)', function (done) {
            mqttClient.publish(
                'ul/1234/timestampedDevice/attrs',
                'tmp|24.4|tt|2016-09-26T12:19:26.476659Z',
                null,
                function (error) {
                    setTimeout(function () {
                        contextBrokerMock.done();
                        done();
                    }, 100);
                }
            );
        });
    });
});
