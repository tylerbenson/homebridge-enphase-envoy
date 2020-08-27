'use strict';

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const parseStringPromise = require('xml2js').parseStringPromise;

const PLUGIN_NAME = 'homebridge-enphase-envoy';
const PLATFORM_NAME = 'enphaseEnvoy';

let Accessory, Characteristic, Service, Categories, UUID;

module.exports = (api) => {
  Accessory = api.platformAccessory;
  Characteristic = api.hap.Characteristic;
  Service = api.hap.Service;
  Categories = api.hap.Categories;
  UUID = api.hap.uuid;
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, envoyPlatform, true);
}

class envoyPlatform {
  constructor(log, config, api) {
    // only load if configured
    if (!config || !Array.isArray(config.devices)) {
      log('No configuration found for %s', PLUGIN_NAME);
      return;
    }
    this.log = log;
    this.config = config;
    this.api = api;
    this.devices = config.devices || [];
    this.accessories = [];

    this.api.on('didFinishLaunching', () => {
      this.log.debug('didFinishLaunching');
      for (let i = 0, len = this.devices.length; i < len; i++) {
        let deviceName = this.devices[i];
        if (!deviceName.name) {
          this.log.warn('Device Name Missing');
        } else {
          this.accessories.push(new envoyDevice(this.log, deviceName, this.api));
        }
      }
    });
  }

  configureAccessory(accessory) {
    this.log.debug('configureAccessory');
    this.accessories.push(accessory);
  }

  removeAccessory(accessory) {
    this.log.debug('removeAccessory');
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
  }
}

class envoyDevice {
  constructor(log, config, api) {
    this.log = log;
    this.api = api;
    this.config = config;


    //device configuration
    this.name = config.name;
    this.host = config.host || 'envoy.local';
    this.refreshInterval = config.refreshInterval || 30;
    this.productionPowerMeter = config.productionPowerMeter || 0;
    this.maxPowerProductionDetected = config.maxPowerProductionDetected;
    this.consumptionPowerMeter = config.consumptionPowerMeter || 0;
    this.maxPowerConsumptionDetected = config.maxPowerConsumptionDetected;

    //get Device info
    this.manufacturer = config.manufacturer || 'Enphase';
    this.modelName = config.modelName || 'Envoy-S';
    this.serialNumber = config.serialNumber || 'SN0000005';
    this.firmwareRevision = config.firmwareRevision || 'FW0000005';

    //setup variables
    this.checkDeviceInfo = false;
    this.checkDeviceState = false;
    this.maxPowerProduction = 0;
    this.maxPowerProductionDetectedState = 0;
    this.productionwNow = 0;
    this.productionwhToday = 0;
    this.productionwhLastSevenDays = 0;
    this.productionwhLifetime = 0;
    this.maxTotalPowerConsumption = 0;
    this.maxTotalPowerConsumptionDetectedState = 0;
    this.totalConsumptionwNow = 0;
    this.totalConsumptionwhToday = 0;
    this.totalConsumptionwhLastSevenDays = 0;
    this.totalConsumptionwhLifetime = 0;
    this.maxNetPowerConsumption = 0;
    this.maxNetPowerConsumptionDetectedState = 0;
    this.netConsumptionwNow = 0;
    this.netConsumptionwhToday = 0;
    this.netConsumptionwhLastSevenDays = 0;
    this.netConsumptionwhLifetime = 0;
    this.prefDir = path.join(api.user.storagePath(), 'enphaseEnvoy');
    this.maxPowerProductionFile = this.prefDir + '/' + 'maxPowerProduction_' + this.host.split('.').join('');
    this.maxTotalPowerConsumptionFile = this.prefDir + '/' + 'maxTotalPowerConsumption_' + this.host.split('.').join('');
    this.maxNetPowerConsumptionFile = this.prefDir + '/' + 'maxNetPowerConsumption_' + this.host.split('.').join('');
    this.url = 'http://' + this.host;

    //check if prefs directory ends with a /, if not then add it
    if (this.prefDir.endsWith('/') === false) {
      this.prefDir = this.prefDir + '/';
    }

    //check if the directory exists, if not then create it
    if (fs.existsSync(this.prefDir) === false) {
      fs.mkdir(this.prefDir, { recursive: false }, (error) => {
        if (error) {
          this.log.error('Device: %s %s, create directory: %s, error: %s', this.host, this.name, this.prefDir, error);
        } else {
          this.log.debug('Device: %s %s, create directory successful: %s', this.host, this.name, this.prefDir);
        }
      });
    }

    //Check device state
    setInterval(function () {
      if (this.checkDeviceInfo) {
        this.getDeviceInfo();
      }
      if (this.checkDeviceState) {
        this.updateDeviceState();
      }
    }.bind(this), this.refreshInterval * 1000);

    this.prepareEnvoyService();
  }

  //Prepare TV service 
  prepareEnvoyService() {
    this.log.debug('prepareEnvoyService');
    const accessoryName = this.name;
    const accessoryUUID = UUID.generate(accessoryName);
    this.accessory = new Accessory(accessoryName, accessoryUUID);
    this.accessory.category = Categories.SENSOR;

    this.accessory.getService(Service.AccessoryInformation)
      .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
      .setCharacteristic(Characteristic.Model, this.modelName)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumber)
      .setCharacteristic(Characteristic.FirmwareRevision, this.firmwareRevision);

    this.envoyServiceProduction = new Service.CarbonDioxideSensor('Power Production', 'envoyServiceProduction');

    this.envoyServiceProduction.getCharacteristic(Characteristic.CarbonDioxideDetected)
      .on('get', this.getMaxPowerProductionDetected.bind(this));

    this.envoyServiceProduction.getCharacteristic(Characteristic.CarbonDioxideLevel)
      .on('get', this.getPowerProduction.bind(this));

    this.envoyServiceProduction.getCharacteristic(Characteristic.CarbonDioxidePeakLevel)
      .on('get', this.getMaxPowerProduction.bind(this));

    this.accessory.addService(this.envoyServiceProduction);

    if (this.consumptionPowerMeter == 1) {
      this.envoyServiceConsumption = new Service.CarbonDioxideSensor('Power Consumption', 'envoyServiceConsumption');

      this.envoyServiceConsumption.getCharacteristic(Characteristic.CarbonDioxideDetected)
        .on('get', this.getMaxTotalPowerConsumptionDetected.bind(this));

      this.envoyServiceConsumption.getCharacteristic(Characteristic.CarbonDioxideLevel)
        .on('get', this.getTotalPowerConsumption.bind(this));

      this.envoyServiceConsumption.getCharacteristic(Characteristic.CarbonDioxidePeakLevel)
        .on('get', this.getMaxTotalPowerConsumption.bind(this));

      this.accessory.addService(this.envoyServiceConsumption);
    }

    this.checkDeviceInfo = true;

    this.log.debug('Device: %s %s, publishExternalAccessories.', this.host, accessoryName);
    this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
  }

  getDeviceInfo() {
    var me = this;
    me.log.debug('Device: %s %s, requesting config information.', me.host, me.name);
    axios.get(me.url + '/production.json').then(response => {
      me.log.info('Device: %s %s, state: Online.', me.host, me.name);
      me.log.debug('Device %s %s, get device status data: %s', me.host, me.name, response.data);
      me.inverters = response.data.production[0].activeCount;
      axios.get(me.url + '/info.xml').then(response => {
        parseStringPromise(response.data).then(result => {
          me.log.debug('Device: %s %s, get Device info successful: %s', me.host, me.name, JSON.stringify(result, null, 2));
          let serialNumber = result.envoy_info.device[0].sn[0];
          let firmware = result.envoy_info.device[0].software[0];
          let inverters = me.inverters
          me.log('-------- %s --------', me.name);
          me.log('Manufacturer: %s', me.manufacturer);
          me.log('Model: %s', me.modelName);
          me.log('Serialnr: %s', serialNumber);
          me.log('Firmware: %s', firmware);
          me.log('Inverters: %s', inverters);
          me.log('----------------------------------');
          me.serialNumber = serialNumber;
          me.firmwareRevision = firmware;
        }).catch(error => {
          me.log.error('Device %s %s, getDeviceInfo parse string error: %s', me.host, me.name, error);
        });
      }).catch(error => {
        me.log.error('Device: %s %s, getDeviceInfo eror: %s', me.host, me.name, error);
      });
      me.checkDeviceInfo = false;
      me.checkDeviceState = true;
    }).catch(error => {
      me.log.error('Device: %s %s, getProduction eror: %s, state: Offline', me.host, me.name, error);
      me.checkDeviceInfo = true;
      me.checkDeviceState = false;
    });
  }

  updateDeviceState() {
    var me = this;
    axios.get(me.url + '/production.json').then(response => {
      me.log.debug('Device %s %s, get device status data: %s', me.host, me.name, response.data);
      let result = response.data;
      me.log.debug(result);

      //production
      let productionwNow = parseFloat(result.production[me.productionPowerMeter].wNow / 1000).toFixed(3);
      if (productionwNow < 0) {
        productionwNow = 0;
      }

      //save and read maxPowerProduction
      let savedMaxPowerProduction;
      try {
        savedMaxPowerProduction = fs.readFileSync(me.maxPowerProductionFile);
      } catch (error) {
        me.log.debug('Device: %s %s, maxPowerProductionFile file does not exist', me.host, me.name);
      }

      let maxPowerProduction = me.maxPowerProduction;
      if (savedMaxPowerProduction) {
        maxPowerProduction = savedMaxPowerProduction;
      }

      if (productionwNow > maxPowerProduction) {
        fs.writeFile(me.maxPowerProductionFile, (productionwNow), (error) => {
          if (error) {
            me.log.error('Device: %s %s, could not write maxPowerProductionFile, error: %s', me.host, me.name, error);
          } else {
            me.log.debug('Device: %s %s, maxPowerProductionFile saved successful in: %s %s kW', me.host, me.name, me.prefDir, productionwNow);
          }
        });
      }

      let maxPowerProductionDetectedState = 0;
      if (productionwNow >= me.maxPowerProductionDetected / 1000) {
        maxPowerProductionDetectedState = 1;
      }
      me.maxPowerProduction = maxPowerProduction;
      me.maxPowerProductionDetectedState = maxPowerProductionDetectedState;

      if (me.envoyServiceProduction) {
        me.envoyServiceProduction.updateCharacteristic(Characteristic.CarbonDioxideDetected, maxPowerProductionDetectedState);
        me.envoyServiceProduction.updateCharacteristic(Characteristic.CarbonDioxideLevel, productionwNow * 1000);
        me.envoyServiceProduction.updateCharacteristic(Characteristic.CarbonDioxidePeakLevel, maxPowerProduction * 1000);
      }

      let productionwhLifetime = parseFloat(result.production[me.productionPowerMeter].whLifetime / 1000).toFixed(3);
      me.log.debug('Device: %s %s, max power production: %s kW', me.host, me.name, maxPowerProduction);
      me.log.debug('Device: %s %s, max power detected: %s', me.host, me.name, maxPowerProductionDetectedState ? 'Yes' : 'No');
      me.log.debug('Device: %s %s, power production: %s kW', me.host, me.name, productionwNow);
      me.log.debug('Device: %s %s, energy production Lifetime: %s kWh', me.host, me.name, productionwhLifetime);
      me.productionwNow = productionwNow;
      me.productionwhLifetime = productionwhLifetime;

      if (me.productionPowerMeter == 1) {
        let productionwhToday = parseFloat(result.production[1].whToday / 1000).toFixed(3);
        let productionwhLastSevenDays = parseFloat(result.production[1].whLastSevenDays / 1000).toFixed(3);
        me.log.debug('Device: %s %s, energy production Today: %s kWh', me.host, me.name, productionwhToday);
        me.log.debug('Device: %s %s, energy production last seven Days: %s kWh', me.host, me.name, productionwhLastSevenDays);
        me.productionwhToday = productionwhToday;
        me.productionwhLastSevenDays = productionwhLastSevenDays;
      }

      //consumption
      if (me.consumptionPowerMeter == 1) {
        let totalConsumptionwNow = parseFloat(result.consumption[0].wNow / 1000).toFixed(3);
        if (totalConsumptionwNow < 0) {
          totalConsumptionwNow = 0;
        }

        //save and read maxPowerConsumption
        let savedMaxTotalPowerConsumption;
        try {
          savedMaxTotalPowerConsumption = fs.readFileSync(me.maxTotalPowerConsumptionFile);
        } catch (error) {
          me.log.debug('Device: %s %s, maxPowerConsumptionFile file does not exist', me.host, me.name);
        }

        let maxTotalPowerConsumption = me.maxTotalPowerConsumption;
        if (savedMaxTotalPowerConsumption) {
          maxTotalPowerConsumption = savedMaxTotalPowerConsumption;
        }

        if (totalConsumptionwNow > maxTotalPowerConsumption) {
          fs.writeFile(me.maxTotalPowerConsumptionFile, (totalConsumptionwNow), (error) => {
            if (error) {
              me.log.error('Device: %s %s, could not write maxPowerConsumptionFile, error: %s', me.host, me.name, error);
            } else {
              me.log.debug('Device: %s %s, maxPowerConsumptionFile saved successful in: %s %s kW', me.host, me.name, me.prefDir, totalConsumptionwNow);
            }
          });
        }

        let maxTotalPowerConsumptionDetectedState = 0;
        if (totalConsumptionwNow >= me.maxTotalPowerConsumptionDetected / 1000) {
          maxTotalPowerConsumptionDetectedState = 1;
        }
        me.maxTotalPowerConsumption = maxTotalPowerConsumption;
        me.maxTotalPowerConsumptionDetectedState = maxTotalPowerConsumptionDetectedState;

        if (me.envoyServiceConsumption) {
          me.envoyServiceConsumption.updateCharacteristic(Characteristic.CarbonDioxideDetected, maxTotalPowerConsumptionDetectedState);
          me.envoyServiceConsumption.updateCharacteristic(Characteristic.CarbonDioxideLevel, totalConsumptionwNow * 1000);
          me.envoyServiceConsumption.updateCharacteristic(Characteristic.CarbonDioxidePeakLevel, maxTotalPowerConsumption * 1000);
        }

        let totalConsumptionwhToday = parseFloat(result.consumption[0].whToday / 1000).toFixed(3);
        let totalConsumptionwhLastSevenDays = parseFloat(result.consumption[0].whLastSevenDays / 1000).toFixed(3);
        let totalConsumptionwhLifetime = parseFloat(result.consumption[0].whLifetime / 1000).toFixed(3);
        me.log.debug('Device: %s %s, total power consumption : %s kW', me.host, me.name, totalConsumptionwNow);
        me.log.debug('Device: %s %s, total energy consumption Lifetime: %s kWh', me.host, me.name, totalConsumptionwhLifetime);
        me.log.debug('Device: %s %s, total energy consumption Today: %s kWh', me.host, me.name, totalConsumptionwhToday);
        me.log.debug('Device: %s %s, total energy consumption last seven Days: %s kWh', me.host, me.name, totalConsumptionwhLastSevenDays);
        me.totalConsumptionwNow = totalConsumptionwNow;
        me.totalConsumptionwhToday = totalConsumptionwhToday;
        me.totalConsumptionwhLastSevenDays = totalConsumptionwhLastSevenDays;
        me.totalConsumptionwhLifetime = totalConsumptionwhLifetime;

        let netConsumptionwNow = parseFloat(result.consumption[1].wNow / 1000).toFixed(3);
        let netConsumptionwhToday = parseFloat(result.consumption[1].whToday / 1000).toFixed(3);
        let netConsumptionwhLastSevenDays = parseFloat(result.consumption[1].whLastSevenDays / 1000).toFixed(3);
        let netConsumptionwhLifetime = parseFloat(result.consumption[1].whLifetime / 1000).toFixed(3);
        me.log.debug('Device: %s %s, net power consumption: %s kW', me.host, me.name, netConsumptionwNow);
        me.log.debug('Device: %s %s, net energy consumption Lifetime: %s kWh', me.host, me.name, netConsumptionwhLifetime);
        me.log.debug('Device: %s %s, net energy consumption Today: %s kWh', me.host, me.name, netConsumptionwhToday);
        me.log.debug('Device: %s %s, net energy consumption last seven Days: %s kWh', me.host, me.name, netConsumptionwhLastSevenDays);
        me.netConsumptionwNow = netConsumptionwNow;
        me.netConsumptionwhToday = netConsumptionwhToday;
        me.netConsumptionwhLastSevenDays = netConsumptionwhLastSevenDays;
        me.netConsumptionwhLifetime = netConsumptionwhLifetime;
      }
    }).catch(error => {
      me.log.error('Device: %s %s, update Device state error: %s, state: Offline', me.host, me.name, error);
    });
  }

  //production
  getMaxPowerProductionDetected(callback) {
    var me = this;
    let state = me.maxPowerDetectedState;
    me.log.info('Device: %s %s, max power production detected: %s', me.host, me.name, state ? 'Yes' : 'No');
    callback(null, state);
  }

  getMaxPowerProduction(callback) {
    var me = this;
    let power = me.maxPowerProduction;
    me.log.info('Device: %s %s, max power production: %s kW', me.host, me.name, power);
    callback(null, power * 1000);
  }

  getPowerProduction(callback) {
    var me = this;
    let wNow = me.productionwNow;
    me.log.info('Device: %s %s, power production: %s kW', me.host, me.name, wNow);
    callback(null, wNow * 1000);
  }

  //consumption
  getMaxTotalPowerConsumptionDetected(callback) {
    var me = this;
    let state = me.maxTotalPowerConsumptionDetectedState;
    me.log.info('Device: %s %s, max power consumption detected: %s', me.host, me.name, state ? 'Yes' : 'No');
    callback(null, state);
  }

  getMaxTotalPowerConsumption(callback) {
    var me = this;
    let power = me.maxTotalPowerConsumption;
    me.log.info('Device: %s %s, max power consumption: %s kW', me.host, me.name, power);
    callback(null, power * 1000);
  }

  getTotalPowerConsumption(callback) {
    var me = this;
    let wNow = me.totalConsumptionwNow;
    me.log.info('Device: %s %s, power consumption: %s kW', me.host, me.name, wNow);
    me.getTotalConsumption();
    me.getNetConsumption();
    callback(null, wNow * 1000);
  }

  getTotalConsumption() {
    var me = this;
    let whToday = me.totalConsumptionwhToday;
    let whLastSevenDays = me.totalConsumptionwhLastSevenDays;
    let whLifetime = me.totalConsumptionwhLifetime;
    me.log('Device: %s %s, total energy consumption Lifetime: %s kWh', me.host, me.name, whLifetime);
    me.log('Device: %s %s, total energy consumption Today: %s kWh', me.host, me.name, whToday);
    me.log('Device: %s %s, total energy consumption last seven Days: %s kWh', me.host, me.name, whLastSevenDays);
  }

  getNetConsumption() {
    var me = this;
    let whToday = me.netConsumptionwhToday;
    let whLastSevenDays = me.netConsumptionwhLastSevenDays;
    let whLifetime = me.netConsumptionwhLifetime;
    me.log('Device: %s %s, net energy consumption Lifetime: %s kWh', me.host, me.name, whLifetime);
    me.log('Device: %s %s, net energy consumption Today: %s kWh', me.host, me.name, whToday);
    me.log('Device: %s %s, net energy consumption last seven Days: %s kWh', me.host, me.name, whLastSevenDays);
  }
}

