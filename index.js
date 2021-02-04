'use strict';
const axios = require('axios').default;
const http = require('urllib');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const inherits = require('util').inherits;
const parseStringPromise = require('xml2js').parseStringPromise;

const PLUGIN_NAME = 'homebridge-enphase-envoy';
const PLATFORM_NAME = 'enphaseEnvoy';

const INFO_URL = '/info.xml';
const HOME_URL = '/home.json';
const PRODUCTION_CT_URL = '/production.json';
const PRODUCTION_CT_DETAILS_URL = '/production.json?details=1';
const PRODUCTION_SUMM_INVERTERS_URL = '/api/v1/production';
const PRODUCTION_INVERTERS_URL = '/api/v1/production/inverters?locale=en';
const CONSUMPTION_SUMM_URL = '/api/v1/consumption';
const INVENTORY_URL = '/inventory.json';
const METERS_URL = '/ivp/meters';
const REPORT_SETTINGS_URL = '/ivp/reportsettings';
const INVERTERS_STATUS_URL = '/installer/agf/inverters_status.json';
const PCU_COMM_CHECK_URL = '/installer/pcu_comm_check';
const NETWORK_INTERFACE = ['Ethernet', 'WiFi', 'Cellurar'];
const ENERGY_TARIFF = ['Single rate', 'Time to use', 'Other'];

const ENVOY_STATUS_CODE = ['undefined',
  'error.nodata', 'envoy.global.ok', 'envoy.cond_flags.acb_ctrl.bmuhardwareerror', 'envoy.cond_flags.acb_ctrl.bmuimageerror', 'envoy.cond_flags.acb_ctrl.bmumaxcurrentwarning', 'envoy.cond_flags.acb_ctrl.bmusenseerror', 'envoy.cond_flags.acb_ctrl.cellmaxtemperror',
  'envoy.cond_flags.acb_ctrl.cellmaxtempwarning', 'envoy.cond_flags.acb_ctrl.cellmaxvoltageerror', 'envoy.cond_flags.acb_ctrl.cellmaxvoltagewarning', 'envoy.cond_flags.acb_ctrl.cellmintemperror',
  'envoy.cond_flags.acb_ctrl.cellmintempwarning', 'envoy.cond_flags.acb_ctrl.cellminvoltageerror', 'envoy.cond_flags.acb_ctrl.cellminvoltagewarning', 'envoy.cond_flags.acb_ctrl.cibcanerror',
  'envoy.cond_flags.acb_ctrl.cibimageerror', 'envoy.cond_flags.acb_ctrl.cibspierror', 'envoy.cond_flags.obs_strs.discovering', 'envoy.cond_flags.obs_strs.failure', 'envoy.cond_flags.obs_strs.flasherror',
  'envoy.cond_flags.obs_strs.notmonitored', 'envoy.cond_flags.obs_strs.ok', 'envoy.cond_flags.obs_strs.plmerror',
  'envoy.cond_flags.obs_strs.secmodeenterfailure', 'envoy.cond_flags.obs_strs.secmodeexitfailure', 'envoy.cond_flags.obs_strs.sleeping', 'envoy.cond_flags.pcu_chan.acMonitorError',
  'envoy.cond_flags.pcu_chan.acfrequencyhigh', 'envoy.cond_flags.pcu_chan.acfrequencylow', 'envoy.cond_flags.pcu_chan.acfrequencyoor', 'envoy.cond_flags.pcu_chan.acvoltage_avg_hi',
  'envoy.cond_flags.pcu_chan.acvoltagehigh', 'envoy.cond_flags.pcu_chan.acvoltagelow', 'envoy.cond_flags.pcu_chan.acvoltageoor', 'envoy.cond_flags.pcu_chan.acvoltageoosp1', 'envoy.cond_flags.pcu_chan.acvoltageoosp2',
  'envoy.cond_flags.pcu_chan.acvoltageoosp3', 'envoy.cond_flags.pcu_chan.agfpowerlimiting', 'envoy.cond_flags.pcu_chan.dcresistancelow', 'envoy.cond_flags.pcu_chan.dcresistancelowpoweroff',
  'envoy.cond_flags.pcu_chan.dcvoltagetoohigh', 'envoy.cond_flags.pcu_chan.dcvoltagetoolow', 'envoy.cond_flags.pcu_chan.dfdt', 'envoy.cond_flags.pcu_chan.gfitripped',
  'envoy.cond_flags.pcu_chan.gridgone', 'envoy.cond_flags.pcu_chan.gridinstability', 'envoy.cond_flags.pcu_chan.gridoffsethi', 'envoy.cond_flags.pcu_chan.gridoffsetlow',
  'envoy.cond_flags.pcu_chan.hardwareError', 'envoy.cond_flags.pcu_chan.hardwareWarning', 'envoy.cond_flags.pcu_chan.highskiprate', 'envoy.cond_flags.pcu_chan.invalidinterval', 'envoy.cond_flags.pcu_chan.pwrgenoffbycmd',
  'envoy.cond_flags.pcu_chan.skippedcycles', 'envoy.cond_flags.pcu_chan.vreferror', 'envoy.cond_flags.pcu_ctrl.alertactive', 'envoy.cond_flags.pcu_ctrl.altpwrgenmode', 'envoy.cond_flags.pcu_ctrl.altvfsettings',
  'envoy.cond_flags.pcu_ctrl.badflashimage', 'envoy.cond_flags.pcu_ctrl.bricked', 'envoy.cond_flags.pcu_ctrl.commandedreset', 'envoy.cond_flags.pcu_ctrl.criticaltemperature',
  'envoy.cond_flags.pcu_ctrl.dc-pwr-low', 'envoy.cond_flags.pcu_ctrl.iuplinkproblem', 'envoy.cond_flags.pcu_ctrl.manutestmode', 'envoy.cond_flags.pcu_ctrl.nsync', 'envoy.cond_flags.pcu_ctrl.overtemperature', 'envoy.cond_flags.pcu_ctrl.poweronreset', 'envoy.cond_flags.pcu_ctrl.pwrgenoffbycmd', 'envoy.cond_flags.pcu_ctrl.runningonac', 'envoy.cond_flags.pcu_ctrl.tpmtest',
  'envoy.cond_flags.pcu_ctrl.unexpectedreset', 'envoy.cond_flags.pcu_ctrl.watchdogreset', 'envoy.cond_flags.rgm_chan.check_meter', 'envoy.cond_flags.rgm_chan.power_quality'
]
const ENVOY_STATUS_CODE_1 = ['Status not available', 'No Data', 'Normal', 'BMU Hardware Error', 'BMU Image Error', 'BMU Max Current Warning', 'BMU Sense Error',
  'Cell Max Temperature Error', 'Cell Max Temperature Warning', 'Cell Max Voltage Error', 'Cell Max Voltage Warning', 'Cell Min Temperature Error', 'Cell Min Temperature Warning',
  'Cell Min Voltage Error', 'Cell Min Voltage Warning', 'CIB CAN Error', 'CIB Image Error', 'CIB SPI Error', 'Discovering', 'Failure to report',
  'Flash Error', 'Not Monitored', 'Normal', 'PLM Error', 'Secure mode enter failure', 'Secure mode exit failure', 'Sleeping', 'AC Monitor Error',
  'AC Frequency High', 'AC Frequency Low', 'AC Frequency Out Of Range', 'AC Voltage Average High', 'AC Voltage High', 'AC Voltage Low', 'AC Voltage Out Of Range', 'AC Voltage Out Of Range - Phase 1', 'AC Voltage Out Of Range - Phase 2',
  'AC Voltage Out Of Range - Phase 3', 'AGF Power Limiting', 'DC Resistance Low', 'DC Resistance Low - Power Off', 'DC Voltage Too High', 'DC Voltage Too Low', 'AC Frequency Changing too Fast',
  'GFI Tripped', 'Grid Gone', 'Grid Instability', 'Grid Offset Hi', 'Grid Offset Low', 'Hardware Error', 'Hardware Warning', 'High Skip Rate', 'Invalid Interval', 'Power generation off by command',
  'Skipped Cycles', 'Voltage Ref Error', 'Alert Active', 'Alternate Power Generation Mode', 'Alternate Voltage and Frequency Settings', 'Bad Flash Image', 'No Grid Profile',
  'Commanded Reset', 'Critical Temperature', 'DC Power Too Low', 'IUP Link Problem', 'In Manu Test Mode', 'Grid Perturbation Unsynchronized', 'Over Temperature', 'Power On Reset', 'Power generation off by command',
  'Running on AC', 'Transient Grid Profile', 'Unexpected Reset', 'Watchdog Reset', 'Meter Error', 'Poor Power Quality'
]

let Accessory, Characteristic, Service, Categories, UUID;

module.exports = (api) => {
  Accessory = api.platformAccessory;
  Characteristic = api.hap.Characteristic;
  Service = api.hap.Service;
  Categories = api.hap.Categories;
  UUID = api.hap.uuid;

  //Envoy production/consumption characteristics
  Characteristic.enphasePower = function () {
    Characteristic.call(this, 'Power', Characteristic.enphasePower.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kW',
      minValue: -10000,
      maxValue: 10000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphasePower, Characteristic);
  Characteristic.enphasePower.UUID = '00000101-000B-1000-8000-0026BB765291';

  Characteristic.enphasePowerMax = function () {
    Characteristic.call(this, 'Power max', Characteristic.enphasePowerMax.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kW',
      minValue: -10000,
      maxValue: 10000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphasePowerMax, Characteristic);
  Characteristic.enphasePowerMax.UUID = '00000102-000B-1000-8000-0026BB765291';

  Characteristic.enphasePowerMaxDetected = function () {
    Characteristic.call(this, 'Power max detected', Characteristic.enphasePowerMaxDetected.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphasePowerMaxDetected, Characteristic);
  Characteristic.enphasePowerMaxDetected.UUID = '00000103-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnergyToday = function () {
    Characteristic.call(this, 'Energy today', Characteristic.enphaseEnergyToday.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kWh',
      minValue: 0,
      maxValue: 1000000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnergyToday, Characteristic);
  Characteristic.enphaseEnergyToday.UUID = '00000104-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnergyLastSevenDays = function () {
    Characteristic.call(this, 'Energy last 7 days', Characteristic.enphaseEnergyLastSevenDays.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kWh',
      minValue: 0,
      maxValue: 1000000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnergyLastSevenDays, Characteristic);
  Characteristic.enphaseEnergyLastSevenDays.UUID = '00000105-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnergyLifetime = function () {
    Characteristic.call(this, 'Energy Lifetime', Characteristic.enphaseEnergyLifetime.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kWh',
      minValue: 0,
      maxValue: 1000000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnergyLifetime, Characteristic);
  Characteristic.enphaseEnergyLifetime.UUID = '00000106-000B-1000-8000-0026BB765291';

  Characteristic.enphaseLastReportDate = function () {
    Characteristic.call(this, 'Last report', Characteristic.enphaseLastReportDate.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseLastReportDate, Characteristic);
  Characteristic.enphaseLastReportDate.UUID = '00000107-000B-1000-8000-0026BB765291';

  //power production service
  Service.enphasePowerEnergyMeter = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphasePowerEnergyMeter.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphasePower);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphasePowerMax);
    this.addOptionalCharacteristic(Characteristic.enphasePowerMaxDetected);
    this.addOptionalCharacteristic(Characteristic.enphaseEnergyToday);
    this.addOptionalCharacteristic(Characteristic.enphaseEnergyLastSevenDays);
    this.addOptionalCharacteristic(Characteristic.enphaseEnergyLifetime);
    this.addOptionalCharacteristic(Characteristic.enphaseLastReportDate);
  };
  inherits(Service.enphasePowerEnergyMeter, Service);
  Service.enphasePowerEnergyMeter.UUID = '00000001-000A-1000-8000-0026BB765291';

  //Envoy
  Characteristic.enphaseEnvoyAllerts = function () {
    Characteristic.call(this, 'Allerts', Characteristic.enphaseEnvoyAllerts.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyAllerts, Characteristic);
  Characteristic.enphaseEnvoyAllerts.UUID = '00000111-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyPrimaryInterface = function () {
    Characteristic.call(this, 'Network interface', Characteristic.enphaseEnvoyPrimaryInterface.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyPrimaryInterface, Characteristic);
  Characteristic.enphaseEnvoyPrimaryInterface.UUID = '00000112-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyNetworkWebComm = function () {
    Characteristic.call(this, 'Web communication', Characteristic.enphaseEnvoyNetworkWebComm.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyNetworkWebComm, Characteristic);
  Characteristic.enphaseEnvoyNetworkWebComm.UUID = '00000113-000B-1000-8000-0026BB765291';


  Characteristic.enphaseEnvoyEverReportedToEnlighten = function () {
    Characteristic.call(this, 'Report to Enlighten', Characteristic.enphaseEnvoyEverReportedToEnlighten.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyEverReportedToEnlighten, Characteristic);
  Characteristic.enphaseEnvoyEverReportedToEnlighten.UUID = '00000114-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyCommNumAndLevel = function () {
    Characteristic.call(this, 'Devices and level', Characteristic.enphaseEnvoyCommNumAndLevel.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyCommNumAndLevel, Characteristic);
  Characteristic.enphaseEnvoyCommNumAndLevel.UUID = '00000115-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyCommNumPcuAndLevel = function () {
    Characteristic.call(this, 'Microinverters and level', Characteristic.enphaseEnvoyCommNumPcuAndLevel.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyCommNumPcuAndLevel, Characteristic);
  Characteristic.enphaseEnvoyCommNumPcuAndLevel.UUID = '00000116-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyCommNumAcbAndLevel = function () {
    Characteristic.call(this, 'Encharges and level', Characteristic.enphaseEnvoyCommNumAcbAndLevel.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyCommNumAcbAndLevel, Characteristic);
  Characteristic.enphaseEnvoyCommNumAcbAndLevel.UUID = '00000117-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyCommNumNsrbAndLevel = function () {
    Characteristic.call(this, 'Q-Relays and level', Characteristic.enphaseEnvoyCommNumNsrbAndLevel.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyCommNumNsrbAndLevel, Characteristic);
  Characteristic.enphaseEnvoyCommNumNsrbAndLevel.UUID = '00000118-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyDbSize = function () {
    Characteristic.call(this, 'DB size', Characteristic.enphaseEnvoyDbSize.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyDbSize, Characteristic);
  Characteristic.enphaseEnvoyDbSize.UUID = '00000119-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyTariff = function () {
    Characteristic.call(this, 'Tariff', Characteristic.enphaseEnvoyTariff.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyTariff, Characteristic);
  Characteristic.enphaseEnvoyTariff.UUID = '00000120-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyUpdateStatus = function () {
    Characteristic.call(this, 'Update status', Characteristic.enphaseEnvoyUpdateStatus.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyUpdateStatus, Characteristic);
  Characteristic.enphaseEnvoyUpdateStatus.UUID = '00000121-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyTimeZone = function () {
    Characteristic.call(this, 'Time Zone', Characteristic.enphaseEnvoyTimeZone.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyTimeZone, Characteristic);
  Characteristic.enphaseEnvoyTimeZone.UUID = '00000122-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyCurrentDateTime = function () {
    Characteristic.call(this, 'Local time', Characteristic.enphaseEnvoyCurrentDateTime.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyCurrentDateTime, Characteristic);
  Characteristic.enphaseEnvoyCurrentDateTime.UUID = '00000123-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnvoyLastEnlightenReporTime = function () {
    Characteristic.call(this, 'Last report to Enlighten', Characteristic.enphaseEnvoyLastEnlightenReporTime.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnvoyLastEnlightenReporTime, Characteristic);
  Characteristic.enphaseEnvoyLastEnlightenReporTime.UUID = '00000124-000B-1000-8000-0026BB765291';

  //power production service
  Service.enphaseEnvoy = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphaseEnvoy.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphaseEnvoyAllerts);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyPrimaryInterface);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyNetworkWebComm);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyEverReportedToEnlighten);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyCommNumAndLevel);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyCommNumPcuAndLevel);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyCommNumAcbAndLevel);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyCommNumNsrbAndLevel);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyDbSize);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyTariff);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyUpdateStatus);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyTimeZone);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyCurrentDateTime);
    this.addOptionalCharacteristic(Characteristic.enphaseEnvoyLastEnlightenReporTime);
  };
  inherits(Service.enphaseEnvoy, Service);
  Service.enphaseEnvoy.UUID = '00000002-000A-1000-8000-0026BB765291';

  //Q-Relay
  Characteristic.enphaseQrelayState = function () {
    Characteristic.call(this, 'Relay', Characteristic.enphaseQrelayState.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayState, Characteristic);
  Characteristic.enphaseQrelayState.UUID = '00000131-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayLinesCount = function () {
    Characteristic.call(this, 'Lines', Characteristic.enphaseQrelayLinesCount.UUID);
    this.setProps({
      format: Characteristic.Formats.INT,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayLinesCount, Characteristic);
  Characteristic.enphaseQrelayLinesCount.UUID = '00000132-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayLine1Connected = function () {
    Characteristic.call(this, 'Line 1', Characteristic.enphaseQrelayLine1Connected.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayLine1Connected, Characteristic);
  Characteristic.enphaseQrelayLine1Connected.UUID = '00000133-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayLine2Connected = function () {
    Characteristic.call(this, 'Line 2', Characteristic.enphaseQrelayLine2Connected.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayLine2Connected, Characteristic);
  Characteristic.enphaseQrelayLine2Connected.UUID = '00000134-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayLine3Connected = function () {
    Characteristic.call(this, 'Line 3', Characteristic.enphaseQrelayLine3Connected.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayLine3Connected, Characteristic);
  Characteristic.enphaseQrelayLine3Connected.UUID = '00000135-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayProducing = function () {
    Characteristic.call(this, 'Producing', Characteristic.enphaseQrelayProducing.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayProducing, Characteristic);
  Characteristic.enphaseQrelayProducing.UUID = '00000136-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayCommunicating = function () {
    Characteristic.call(this, 'Communicating', Characteristic.enphaseQrelayCommunicating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayCommunicating, Characteristic);
  Characteristic.enphaseQrelayCommunicating.UUID = '00000137-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayProvisioned = function () {
    Characteristic.call(this, 'Provisioned', Characteristic.enphaseQrelayProvisioned.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayProvisioned, Characteristic);
  Characteristic.enphaseQrelayProvisioned.UUID = '00000138-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayOperating = function () {
    Characteristic.call(this, 'Operating', Characteristic.enphaseQrelayOperating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayOperating, Characteristic);
  Characteristic.enphaseQrelayOperating.UUID = '00000139-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayStatus = function () {
    Characteristic.call(this, 'Status', Characteristic.enphaseQrelayStatus.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayStatus, Characteristic);
  Characteristic.enphaseQrelayStatus.UUID = '00000140-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayFirmware = function () {
    Characteristic.call(this, 'Firmware', Characteristic.enphaseQrelayFirmware.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayFirmware, Characteristic);
  Characteristic.enphaseQrelayFirmware.UUID = '00000141-000B-1000-8000-0026BB765291';

  Characteristic.enphaseQrelayLastReportDate = function () {
    Characteristic.call(this, 'Last report', Characteristic.enphaseQrelayLastReportDate.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseQrelayLastReportDate, Characteristic);
  Characteristic.enphaseQrelayLastReportDate.UUID = '00000142-000B-1000-8000-0026BB765291';

  //qrelay service
  Service.enphaseQrelay = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphaseQrelay.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphaseQrelayState);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayLinesCount);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayLine1Connected);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayLine2Connected);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayLine3Connected);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayProducing);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayCommunicating);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayProvisioned);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayOperating);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayStatus);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayFirmware);
    this.addOptionalCharacteristic(Characteristic.enphaseQrelayLastReportDate);
  };
  inherits(Service.enphaseQrelay, Service);
  Service.enphaseQrelay.UUID = '00000003-000A-1000-8000-0026BB765291';

  //enphase current meters
  Characteristic.enphaseMetersState = function () {
    Characteristic.call(this, 'Status', Characteristic.enphaseMetersState.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersState, Characteristic);
  Characteristic.enphaseMetersState.UUID = '00000151-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMetersMeasurementType = function () {
    Characteristic.call(this, 'Meter type', Characteristic.enphaseMetersMeasurementType.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersMeasurementType, Characteristic);
  Characteristic.enphaseMetersMeasurementType.UUID = '00000152-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMetersPhaseCount = function () {
    Characteristic.call(this, 'Phase count', Characteristic.enphaseMetersPhaseCount.UUID);
    this.setProps({
      format: Characteristic.Formats.UINT8,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersPhaseCount, Characteristic);
  Characteristic.enphaseMetersPhaseCount.UUID = '00000153-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMetersPhaseMode = function () {
    Characteristic.call(this, 'Phase mode', Characteristic.enphaseMetersPhaseMode.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersPhaseMode, Characteristic);
  Characteristic.enphaseMetersPhaseMode.UUID = '00000154-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMetersMeteringStatus = function () {
    Characteristic.call(this, 'Metering status', Characteristic.enphaseMetersMeteringStatus.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersMeteringStatus, Characteristic);
  Characteristic.enphaseMetersMeteringStatus.UUID = '00000155-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMetersStatusFlags = function () {
    Characteristic.call(this, 'Status flag', Characteristic.enphaseMetersStatusFlags.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMetersStatusFlags, Characteristic);
  Characteristic.enphaseMetersStatusFlags.UUID = '00000156-000B-1000-8000-0026BB765291';

  //current meters service
  Service.enphaseMeters = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphaseMeters.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphaseMetersState);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphaseMetersPhaseMode);
    this.addOptionalCharacteristic(Characteristic.enphaseMetersPhaseCount);
    this.addOptionalCharacteristic(Characteristic.enphaseMetersMeasurementType);
    this.addOptionalCharacteristic(Characteristic.enphaseMetersMeteringStatus);
    this.addOptionalCharacteristic(Characteristic.enphaseMetersStatusFlags);
  };
  inherits(Service.enphaseMeters, Service);
  Service.enphaseMeters.UUID = '00000004-000A-1000-8000-0026BB765291';

  //Encharge
  Characteristic.enphaseEnchargePower = function () {
    Characteristic.call(this, 'Power', Characteristic.enphaseEnchargePower.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kW',
      minValue: 0,
      maxValue: 1000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargePower, Characteristic);
  Characteristic.enphaseEnchargePower.UUID = '00000161-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeEnergy = function () {
    Characteristic.call(this, 'Energy', Characteristic.enphaseEnchargeEnergy.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'kWh',
      minValue: 0,
      maxValue: 1000,
      minStep: 0.001,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeEnergy, Characteristic);
  Characteristic.enphaseEnchargeEnergy.UUID = '00000162-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeState = function () {
    Characteristic.call(this, 'State', Characteristic.enphaseEnchargeState.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeState, Characteristic);
  Characteristic.enphaseEnchargeState.UUID = '00000163-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeProducing = function () {
    Characteristic.call(this, 'Producing', Characteristic.enphaseEnchargeProducing.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeProducing, Characteristic);
  Characteristic.enphaseEnchargeProducing.UUID = '00000164-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeCommunicating = function () {
    Characteristic.call(this, 'Communicating', Characteristic.enphaseEnchargeCommunicating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeCommunicating, Characteristic);
  Characteristic.enphaseEnchargeCommunicating.UUID = '00000165-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeProvisioned = function () {
    Characteristic.call(this, 'Provisioned', Characteristic.enphaseEnchargeProvisioned.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeProvisioned, Characteristic);
  Characteristic.enphaseEnchargeProvisioned.UUID = '00000166-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeOperating = function () {
    Characteristic.call(this, 'Operating', Characteristic.enphaseEnchargeOperating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeOperating, Characteristic);
  Characteristic.enphaseEnchargeOperating.UUID = '00000167-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeStatus = function () {
    Characteristic.call(this, 'Status', Characteristic.enphaseEnchargeStatus.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeStatus, Characteristic);
  Characteristic.enphaseEnchargeStatus.UUID = '00000168-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeFirmware = function () {
    Characteristic.call(this, 'Firmware', Characteristic.enphaseEnchargeFirmware.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeFirmware, Characteristic);
  Characteristic.enphaseEnchargeFirmware.UUID = '00000169-000B-1000-8000-0026BB765291';

  Characteristic.enphaseEnchargeLastReportDate = function () {
    Characteristic.call(this, 'Last report', Characteristic.enphaseEnchargeLastReportDate.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseEnchargeLastReportDate, Characteristic);
  Characteristic.enphaseEnchargeLastReportDate.UUID = '00000170-000B-1000-8000-0026BB765291';

  //Encharge service
  Service.enphaseEncharge = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphaseEncharge.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphaseEnchargPower);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeEnergy);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeProducing);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeCommunicating);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeProvisioned);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeOperating);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeStatus);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeFirmware);
    this.addOptionalCharacteristic(Characteristic.enphaseEnchargeLastReportDate);
  };
  inherits(Service.enphaseEncharge, Service);
  Service.enphaseEncharge.UUID = '00000005-000A-1000-8000-0026BB765291';

  //Microinverter
  Characteristic.enphaseMicroinverterPower = function () {
    Characteristic.call(this, 'Power', Characteristic.enphaseMicroinverterPower.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'W',
      minValue: 0,
      maxValue: 1000,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterPower, Characteristic);
  Characteristic.enphaseMicroinverterPower.UUID = '00000181-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterPowerMax = function () {
    Characteristic.call(this, 'Power max', Characteristic.enphaseMicroinverterPowerMax.UUID);
    this.setProps({
      format: Characteristic.Formats.FLOAT,
      unit: 'W',
      minValue: 0,
      maxValue: 1000,
      minStep: 1,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterPowerMax, Characteristic);
  Characteristic.enphaseMicroinverterPowerMax.UUID = '00000182-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterProducing = function () {
    Characteristic.call(this, 'Producing', Characteristic.enphaseMicroinverterProducing.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterProducing, Characteristic);
  Characteristic.enphaseMicroinverterProducing.UUID = '00000183-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterCommunicating = function () {
    Characteristic.call(this, 'Communicating', Characteristic.enphaseMicroinverterCommunicating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterCommunicating, Characteristic);
  Characteristic.enphaseMicroinverterCommunicating.UUID = '00000184-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterProvisioned = function () {
    Characteristic.call(this, 'Provisioned', Characteristic.enphaseMicroinverterProvisioned.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterProvisioned, Characteristic);
  Characteristic.enphaseMicroinverterProvisioned.UUID = '00000185-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterOperating = function () {
    Characteristic.call(this, 'Operating', Characteristic.enphaseMicroinverterOperating.UUID);
    this.setProps({
      format: Characteristic.Formats.BOOL,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterOperating, Characteristic);
  Characteristic.enphaseMicroinverterOperating.UUID = '00000186-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterStatus = function () {
    Characteristic.call(this, 'Status', Characteristic.enphaseMicroinverterStatus.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterStatus, Characteristic);
  Characteristic.enphaseMicroinverterStatus.UUID = '00000187-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterFirmware = function () {
    Characteristic.call(this, 'Firmware', Characteristic.enphaseMicroinverterFirmware.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterFirmware, Characteristic);
  Characteristic.enphaseMicroinverterFirmware.UUID = '00000188-000B-1000-8000-0026BB765291';

  Characteristic.enphaseMicroinverterLastReportDate = function () {
    Characteristic.call(this, 'Last report', Characteristic.enphaseMicroinverterLastReportDate.UUID);
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  };
  inherits(Characteristic.enphaseMicroinverterLastReportDate, Characteristic);
  Characteristic.enphaseMicroinverterLastReportDate.UUID = '00000189-000B-1000-8000-0026BB765291';

  //devices service
  Service.enphaseMicroinverter = function (displayName, subtype) {
    Service.call(this, displayName, Service.enphaseMicroinverter.UUID, subtype);
    // Mandatory Characteristics
    this.addCharacteristic(Characteristic.enphaseMicroinverterPower);
    // Optional Characteristics
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterPowerMax);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterProducing);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterCommunicating);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterProvisioned);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterOperating);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterStatus);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterFirmware);
    this.addOptionalCharacteristic(Characteristic.enphaseMicroinverterLastReportDate);
  };
  inherits(Service.enphaseMicroinverter, Service);
  Service.enphaseMicroinverter.UUID = '00000006-000A-1000-8000-0026BB765291';

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

    this.api.on('didFinishLaunching', () => {
      this.log.debug('didFinishLaunching');
      for (let i = 0, len = this.devices.length; i < len; i++) {
        let deviceName = this.devices[i];
        if (!deviceName.name) {
          this.log.warn('Device Name Missing');
        } else {
          new envoyDevice(this.log, deviceName, this.api);
        }
      }
    });

  }

  configureAccessory(platformAccessory) {
    this.log.debug('configurePlatformAccessory');
  }

  removeAccessory(platformAccessory) {
    this.log.debug('removePlatformAccessory');
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [platformAccessory]);
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
    this.installerUser = config.installerUser || 'installer';
    this.installerPasswd = config.installerPasswd;
    this.refreshInterval = config.refreshInterval || 10;
    this.enchargeStorageOffset = config.enchargeStorageOffset || 0;
    this.powerProductionMaxDetected = config.powerProductionMaxDetected || 0;
    this.energyProductionLifetimeOffset = config.energyProductionLifetimeOffset || 0;
    this.powerConsumptionTotalMaxDetected = config.powerConsumptionTotalMaxDetected || 0;
    this.energyConsumptionTotalLifetimeOffset = config.energyConsumptionTotalLifetimeOffset || 0;
    this.powerConsumptionNetMaxDetected = config.powerConsumptionNetMaxDetected || 0;
    this.energyConsumptionNetLifetimeOffset = config.energyConsumptionNetLifetimeOffset || 0;

    //get Device info
    this.manufacturer = config.manufacturer || 'Enphase';
    this.modelName = config.modelName || 'Envoy';

    //setup variables
    this.checkDeviceInfo = false;
    this.checkDeviceState = false;

    this.powerProductionMax = 0;
    this.powerProductionMaxDetectedState = false;
    this.powerProduction = 0;
    this.energyProductionToday = 0;
    this.energyProductionLastSevenDays = 0;
    this.energyProductionLifetime = 0;
    this.powerProductionReadingTime = '';
    this.productionDataOK = false;

    this.powerConsumptionTotalMax = 0;
    this.powerConsumptionTotalMaxDetectedState = false;
    this.powerConsumptionTotal = 0;
    this.energyConsumptionTotalToday = 0;
    this.energyConsumptionTotalLastSevenDays = 0;
    this.energyConsumptionTotalLifetime = 0;
    this.consumptionDataTotalDataOK = false;

    this.powerConsumptionNetMax = 0;
    this.powerConsumptionNetMaxDetectedState = false;
    this.powerConsumptionNet = 0;
    this.energyConsumptionNetToday = 0;
    this.energyConsumptionNetLastSevenDays = 0;
    this.energyConsumptionNetLifetime = 0;
    this.consumptionDataNetDataOK = false;

    this.envoyUser = 'envoy';
    this.envoySerialNumber = '';
    this.envoyFirmware = '';
    this.envoySoftwareBuildEpoch = 0;

    this.envoyIsEnvoy = false;
    this.envoyAllerts = '';
    this.envoyDbSize = '';
    this.envoyDbPercentFull = '';
    this.envoyTariff = '';
    this.envoyPrimaryInterface = '';
    this.envoyNetworkWebComm = false;
    this.envoyEverReportedToEnlighten = false;
    this.envoyCommNum = 0;
    this.envoyCommLevel = 0;
    this.envoyCommPcuNum = 0;
    this.envoyCommPcuLevel = 0;
    this.envoyCommAcbNum = 0;
    this.envoyCommAcbLevel = 0;
    this.envoyCommNsrbNum = 0;
    this.envoyCommNsrbLevel = 0;
    this.envoyUpdateStatus = '';
    this.envoyTimeZone = '';
    this.envoyCurrentDate = '';
    this.envoyCurrentTime = '';
    this.envoyLastEnlightenReporTime = 0;
    this.envoyDataOK = false;

    this.qRelaysCount = 0;
    this.qRelaysSerialNumber = new Array();
    this.qRelaysFirmware = new Array();
    this.qRelaysRelay = new Array();
    this.qRelaysProducing = new Array();
    this.qRelaysCommunicating = new Array();
    this.qRelaysProvisioned = new Array();
    this.qRelaysOperating = new Array();
    this.qRelaysLinesCount = new Array();
    this.qRelaysLine1Connected = new Array();
    this.qRelaysLine2Connected = new Array();
    this.qRelaysLine3Connected = new Array();
    this.qRelaysStatus = new Array();
    this.qRelaysLastReportDate = new Array();
    this.qrelaysDataOK = false;

    this.enchargesCount = 0;
    this.enchargesActiveCount = 0;
    this.enchargesSerialNumber = new Array();
    this.enchargesFirmware = new Array();
    this.enchargesProducing = new Array();
    this.enchargesCommunicating = new Array();
    this.enchargesProvisioned = new Array();
    this.enchargesOperating = new Array();
    this.enchargesStatus = new Array();
    this.enchargesLastReportDate = new Array();
    this.enchargeType = new Array();
    this.enchargeActiveCount = new Array();
    this.enchargesPower = new Array();
    this.enchargesEnergy = new Array();
    this.enchargesState = new Array();
    this.enchargesDataOK = false;
    this.enchargesDataOK1 = false;

    this.metersCount = 0;
    this.metersTypeEnabledCount = 0;
    this.metersProductionActiveCount = 0;
    this.metersConsumtionTotalActiveCount = 0;
    this.metersConsumptionNetActiveCount = 0;
    this.metersEid = new Array();
    this.metersState = new Array();
    this.metersMeasurementType = new Array();
    this.metersPhaseMode = new Array();
    this.metersPhaseCount = new Array();
    this.metersMeteringStatus = new Array();
    this.metersStatusFlags = new Array();
    this.metersDataOK = false;

    this.invertersCount = 0;
    this.invertersActiveCount = 0;
    this.invertersSerialNumber = new Array();
    this.invertersFirmware = new Array();
    this.invertersType = new Array();
    this.invertersLastPower = new Array();
    this.invertersMaxPower = new Array();
    this.invertersProducing = new Array();
    this.invertersCommunicating = new Array();
    this.invertersProvisioned = new Array();
    this.invertersOperating = new Array();
    this.invertersStatus = new Array();
    this.invertersLastReportDate = new Array();
    this.invertersDataOK = false;
    this.invertersDataOK1 = false;
    this.prefDir = path.join(api.user.storagePath(), 'enphaseEnvoy');
    this.powerProductionMaxFile = this.prefDir + '/' + 'powerProductionMax_' + this.host.split('.').join('');
    this.powerConsumptionTotalMaxFile = this.prefDir + '/' + 'powerConsumptionTotalMax_' + this.host.split('.').join('');
    this.powerConsumptionNetMaxFile = this.prefDir + '/' + 'powerConsumptionNetMax_' + this.host.split('.').join('');
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
      } else if (!this.checkDeviceInfo && this.checkDeviceState) {
        this.updateDeviceState();
      }
    }.bind(this), this.refreshInterval * 1000);

    this.getDeviceInfo()
  }

  async getDeviceInfo() {
    var me = this;
    me.log.debug('Device: %s %s, requesting config information.', me.host, me.name);
    try {
      const [inventory, info, meters] = await axios.all([axios.get(me.url + INVENTORY_URL), axios.get(me.url + INFO_URL), axios.get(me.url + METERS_URL)]);
      me.log.info('Device: %s %s, state: Online.', me.host, me.name);
      me.log.debug('Device %s %s, get device status data inventory %s info: %s', me.host, me.name, inventory.data, info.data);
      const result = await parseStringPromise(info.data);
      me.log.debug('Device: %s %s, get Device info.xml successful: %s', me.host, me.name, JSON.stringify(result, null, 2));
      var time = result.envoy_info.time[0];
      var serialNumber = result.envoy_info.device[0].sn[0];
      var firmware = result.envoy_info.device[0].software[0];
      var microinverters = inventory.data[0].devices.length;
      var encharges = inventory.data[1].devices.length;
      var qrelays = inventory.data[2].devices.length;
      var ctmeters = meters.data.length;

      // convert Unix time to local date time
      time = new Date(time * 1000).toLocaleString();

      me.log('-------- %s --------', me.name);
      me.log('Manufacturer: %s', me.manufacturer);
      me.log('Model: %s', me.modelName);
      me.log('Serial: %s', serialNumber);
      me.log('Firmware: %s', firmware);
      me.log('Inverters: %s', microinverters);
      me.log('Encharges: %s', encharges);
      me.log('Q-Relays: %s', qrelays);
      me.log('Meters: %s', ctmeters);
      me.log('Time: %s', time);
      me.log('----------------------------------');
      me.envoyTime = time;
      me.envoySerialNumber = serialNumber;
      me.envoyFirmware = firmware;
      me.invertersCount = microinverters;
      me.enchargesCount = encharges;
      me.qRelaysCount = qrelays;
      me.metersCount = ctmeters;

      me.checkDeviceInfo = false;
      me.updateDeviceState();
    } catch (error) {
      me.log.error('Device: %s %s, getProduction eror: %s, state: Offline', me.host, me.name, error);
      me.checkDeviceInfo = true;
    };
  }

  async updateDeviceState() {
    var me = this;
    try {
      if (me.metersCount > 0) {
        // check enabled inverters, meters, encharges
        const devicesAvtiveCount = await axios.get(me.url + PRODUCTION_CT_URL);
        if (devicesAvtiveCount.status == 200) {
          const invertersActiveCount = devicesAvtiveCount.data.production[0].activeCount;
          const metersProductionCount = devicesAvtiveCount.data.production[1].activeCount;
          const metersConsumtionTotalCount = devicesAvtiveCount.data.consumption[0].activeCount;
          const metersConsumptionNetCount = devicesAvtiveCount.data.consumption[1].activeCount;
          const enchargesActiveCount = devicesAvtiveCount.data.storage[0].activeCount;
          me.invertersActiveCount = invertersActiveCount;
          me.metersProductionActiveCount = metersProductionCount;
          me.metersConsumtionTotalActiveCount = metersConsumtionTotalCount;
          me.metersConsumptionNetActiveCount = metersConsumptionNetCount;
          me.enchargesActiveCount = enchargesActiveCount;
          me.metersTypeEnabledCount = metersProductionCount + metersConsumtionTotalCount + metersConsumptionNetCount;
        }
      }

      var productionUrl = me.metersProductionActiveCount ? me.url + PRODUCTION_CT_URL : me.url + PRODUCTION_SUMM_INVERTERS_URL;
      const [production, productionCT] = await axios.all([axios.get(productionUrl), axios.get(me.url + PRODUCTION_CT_URL)]);
      if (production.status == 200 && productionCT.status == 200) {
        me.log.debug('Device %s %s, get device status production: %s, productionCT %s', me.host, me.name, production.data, productionCT.data);

        const invertersAvtiveCount = productionCT.data.production[0].activeCount;
        me.invertersAvtiveCount = invertersAvtiveCount;

        //production
        // convert Unix time to local date time
        var readindTimeProduction = me.metersProductionActiveCount ? productionCT.data.production[1].readingTime : productionCT.data.production[0].readingTime;
        var lastrptdate = new Date(readindTimeProduction * 1000).toLocaleString();

        //power production
        var powerProduction = me.metersProductionActiveCount ? parseFloat(productionCT.data.production[1].wNow / 1000) : parseFloat(production.data.wattsNow / 1000);

        //save and read powerProductionMax
        try {
          var savedPowerProductionMax = await fsPromises.readFile(me.powerProductionMaxFile);
        } catch (error) {
          me.log.debug('Device: %s %s, powerProductionMaxFile file does not exist', me.host, me.name);
        }

        var powerProductionMax = 0;
        if (savedPowerProductionMax) {
          powerProductionMax = parseFloat(savedPowerProductionMax);
        }

        if (powerProduction > powerProductionMax) {
          var powerProductionMaxf = powerProduction.toString();
          try {
            await fsPromises.writeFile(me.powerProductionMaxFile, powerProductionMaxf);
            me.log.debug('Device: %s %s, powerProductionMaxFile saved successful in: %s %s kW', me.host, me.name, me.prefDir, powerProduction);
          } catch (error) {
            me.log.error('Device: %s %s, could not write powerProductionMaxFile, error: %s', me.host, me.name, error);

          }
        }

        var powerProductionMaxDetectedState = (powerProduction >= me.powerProductionMaxDetected / 1000);
        me.powerProductionMax = powerProductionMax;
        me.powerProductionMaxDetectedState = powerProductionMaxDetectedState;

        var energyProductionToday = me.metersProductionActiveCount ? parseFloat(productionCT.data.production[1].whToday / 1000) : parseFloat(production.data.wattHoursToday / 1000);
        var energyProductionLastSevenDays = me.metersProductionActiveCount ? parseFloat(productionCT.data.production[1].whLastSevenDays / 1000) : parseFloat(production.data.wattHoursSevenDays / 1000);
        var energyProductionLifetime = me.metersProductionActiveCount ? parseFloat((productionCT.data.production[1].whLifetime + me.energyProductionLifetimeOffset) / 1000) : parseFloat((production.data.wattHoursLifetime + me.energyProductionLifetimeOffset) / 1000);
        me.log.debug('Device: %s %s, production report: %s', me.host, me.name, lastrptdate);
        me.log.debug('Device: %s %s, power production: %s kW', me.host, me.name, powerProduction);
        me.log.debug('Device: %s %s, power production max: %s kW', me.host, me.name, powerProductionMax);
        me.log.debug('Device: %s %s, power production max detected: %s', me.host, me.name, powerProductionMaxDetectedState ? 'Yes' : 'No');
        me.log.debug('Device: %s %s, energy production Today: %s kWh', me.host, me.name, energyProductionToday);
        me.log.debug('Device: %s %s, energy production last 7 Days: %s kWh', me.host, me.name, energyProductionLastSevenDays);
        me.log.debug('Device: %s %s, energy production Lifetime: %s kWh', me.host, me.name, energyProductionLifetime);
        me.productionLastReportDate = lastrptdate;
        me.powerProduction = powerProduction;
        me.energyProductionToday = energyProductionToday;
        me.energyProductionLastSevenDays = energyProductionLastSevenDays;
        me.energyProductionLifetime = energyProductionLifetime;
        me.powerProductionMaxDetectedState = powerProductionMaxDetectedState;

        if (me.enphaseServiceProduction) {
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphasePower, powerProduction);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphasePowerMax, powerProductionMax);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphasePowerMaxDetected, powerProductionMaxDetectedState);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphaseEnergyToday, energyProductionToday);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphaseEnergyLastSevenDays, energyProductionLastSevenDays);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphaseEnergyLifetime, energyProductionLifetime);
          me.enphaseServiceProduction.updateCharacteristic(Characteristic.enphaseLastReportDate, lastrptdate);
        }
        me.productionDataOK = true;
      }

      //consumption total
      if (me.metersCount > 0 && me.metersConsumtionTotalActiveCount > 0) {
        // convert Unix time to local date time
        var productionLastReadDate = productionCT.data.consumption[0].readingTime;
        var lastrptdate = new Date(productionLastReadDate * 1000).toLocaleString();

        //power consumption total
        var powerConsumptionTotal = parseFloat(productionCT.data.consumption[0].wNow / 1000);

        //save and read powerConsumptionTotalMax
        try {
          var savedPowerConsumptionTotalMax = await fsPromises.readFile(me.powerConsumptionTotalMaxFile);
        } catch (error) {
          me.log.debug('Device: %s %s, powerConsumptionTotalMaxFile file does not exist', me.host, me.name);
        }

        var powerConsumptionTotalMax = 0;
        if (savedPowerConsumptionTotalMax) {
          powerConsumptionTotalMax = parseFloat(savedPowerConsumptionTotalMax);
        }

        if (powerConsumptionTotal > powerConsumptionTotalMax) {
          var powerConsumptionTotalMaxf = powerConsumptionTotal.toString();
          try {
            await fsPromises.writeFile(me.powerConsumptionTotalMaxFile, powerConsumptionTotalMaxf);
            me.log.debug('Device: %s %s, powerConsumptionTotalMaxFile saved successful in: %s %s kW', me.host, me.name, me.prefDir, powerConsumptionTotal);
          } catch (error) {
            me.log.error('Device: %s %s, could not write powerConsumptionTotalMaxFile, error: %s', me.host, me.name, error);
          }
        }

        var powerConsumptionTotalMaxDetectedState = (me.powerConsumptionTotal >= me.powerConsumptionTotalMaxDetected / 1000);
        me.powerConsumptionTotalMax = powerConsumptionTotalMax;
        me.powerConsumptionTotalMaxDetectedState = powerConsumptionTotalMaxDetectedState;

        var energyConsumptionTotalToday = parseFloat(productionCT.data.consumption[0].whToday / 1000);
        var energyConsumptionTotalLastSevenDays = parseFloat(productionCT.data.consumption[0].whLastSevenDays / 1000);
        var energyConsumptionTotalLifetime = parseFloat((productionCT.data.consumption[0].whLifetime + me.energyConsumptionTotalLifetimeOffset) / 1000);
        me.log.debug('Device: %s %s, total consumption report: %s', me.host, me.name, lastrptdate);
        me.log.debug('Device: %s %s, total power consumption : %s kW', me.host, me.name, powerConsumptionTotal);
        me.log.debug('Device: %s %s, total power consumption max: %s kW', me.host, me.name, powerConsumptionTotalMax);
        me.log.debug('Device: %s %s, total power consumption max detected: %s', me.host, me.name, powerConsumptionTotalMaxDetectedState ? 'Yes' : 'No');
        me.log.debug('Device: %s %s, total energy consumption Today: %s kWh', me.host, me.name, energyConsumptionTotalToday);
        me.log.debug('Device: %s %s, total energy consumption last 7 Days: %s kWh', me.host, me.name, energyConsumptionTotalLastSevenDays);
        me.log.debug('Device: %s %s, total energy consumption Lifetime: %s kWh', me.host, me.name, energyConsumptionTotalLifetime);
        me.totalConsumptionLastReportDate = lastrptdate;
        me.powerConsumptionTotal = powerConsumptionTotal;
        me.energyConsumptionTotalToday = energyConsumptionTotalToday;
        me.energyConsumptionTotalLastSevenDays = energyConsumptionTotalLastSevenDays;
        me.energyConsumptionTotalLifetime = energyConsumptionTotalLifetime;
        me.powerConsumptionTotalMaxDetectedState = powerConsumptionTotalMaxDetectedState;

        if (me.enphaseServiceConsumptionTotal) {
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphasePower, powerConsumptionTotal);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphasePowerMax, powerConsumptionTotalMax);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphasePowerMaxDetected, powerConsumptionTotalMaxDetectedState);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphaseEnergyToday, energyConsumptionTotalToday);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphaseEnergyLastSevenDays, energyConsumptionTotalLastSevenDays);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphaseEnergyLifetime, energyConsumptionTotalLifetime);
          me.enphaseServiceConsumptionTotal.updateCharacteristic(Characteristic.enphaseLastReportDate, lastrptdate);
        }
        me.consumptionTotalDataOK = true;
      }

      //consumption net
      if (me.metersCount > 0 && me.metersConsumptionNetActiveCount > 0) {
        // convert Unix time to local date time
        var netConsumptionLastReadDate = productionCT.data.consumption[1].readingTime;
        var lastrptdate = new Date(netConsumptionLastReadDate * 1000).toLocaleString();

        //power consumption net
        var powerConsumptionNet = parseFloat(productionCT.data.consumption[1].wNow / 1000);

        //save and read powerConsumptionNetMax
        try {
          var savedPowerConsumptionNetMax = await fsPromises.readFile(me.powerConsumptionNetMaxFile);
        } catch (error) {
          me.log.debug('Device: %s %s, powerConsumptionNetMaxFile file does not exist', me.host, me.name);
        }

        var powerConsumptionNetMax = 0;
        if (savedPowerConsumptionNetMax) {
          powerConsumptionNetMax = parseFloat(savedPowerConsumptionNetMax);
        }

        if (powerConsumptionNet > powerConsumptionNetMax) {
          var powerConsumptionNetMaxf = powerConsumptionNet.toString();
          try {
            await fsPromises.writeFile(me.powerConsumptionNetMaxFile, powerConsumptionNetMaxf);
            me.log.debug('Device: %s %s, powerConsumptionNetMaxFile saved successful in: %s %s kW', me.host, me.name, me.prefDir, powerConsumptionNet);
          } catch (error) {
            me.log.error('Device: %s %s, could not write powerConsumptionNetMaxFile, error: %s', me.host, me.name, error);
          }
        }

        var powerConsumptionNetMaxDetectedState = (powerConsumptionNet >= me.powerConsumptionNetMaxDetected / 1000);
        me.powerConsumptionNetMax = powerConsumptionNetMax;
        me.powerConsumptionNetMaxDetectedState = powerConsumptionNetMaxDetectedState;

        var energyConsumptionNetToday = parseFloat(productionCT.data.consumption[1].whToday / 1000);
        var energyConsumptionNetLastSevenDays = parseFloat(productionCT.data.consumption[1].whLastSevenDays / 1000);
        var energyConsumptionNetLifetime = parseFloat((productionCT.data.consumption[1].whLifetime + me.energyConsumptionNetLifetimeOffset) / 1000);
        me.log.debug('Device: %s %s, net consumption report: %s', me.host, me.name, lastrptdate);
        me.log.debug('Device: %s %s, net power consumption: %s kW', me.host, me.name, powerConsumptionNet);
        me.log.debug('Device: %s %s, net power consumption max: %s kW', me.host, me.name, powerConsumptionNetMax);
        me.log.debug('Device: %s %s, net power consumption max detected: %s', me.host, me.name, powerConsumptionNetMaxDetectedState ? 'Yes' : 'No');
        me.log.debug('Device: %s %s, net energy consumption Today: %s kWh', me.host, me.name, energyConsumptionNetToday);
        me.log.debug('Device: %s %s, net energy consumption last 7 Days: %s kWh', me.host, me.name, energyConsumptionNetLastSevenDays);
        me.log.debug('Device: %s %s, net energy consumption Lifetime: %s kWh', me.host, me.name, energyConsumptionNetLifetime);
        me.netConsumptionLastReportDate = lastrptdate;
        me.powerConsumptionNet = powerConsumptionNet;
        me.energyConsumptionNetToday = energyConsumptionNetToday;
        me.energyConsumptionNetLastSevenDays = energyConsumptionNetLastSevenDays;
        me.energyConsumptionNetLifetime = energyConsumptionNetLifetime;
        me.powerConsumptionNetMaxDetectedState = powerConsumptionNetMaxDetectedState;

        if (me.enphaseServiceConsumptionNet) {
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphasePower, powerConsumptionNet);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphasePowerMax, powerConsumptionNetMax);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphasePowerMaxDetected, powerConsumptionNetMaxDetectedState);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphaseEnergyToday, energyConsumptionNetToday);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphaseEnergyLastSevenDays, energyConsumptionNetLastSevenDays);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphaseEnergyLifetime, energyConsumptionNetLifetime);
          me.enphaseServiceConsumptionNet.updateCharacteristic(Characteristic.enphaseLastReportDate, lastrptdate);
        }
        me.consumptionNetDataOK = true;
      }

      //envoy
      const home = await axios.get(me.url + HOME_URL);
      if (home.status == 200) {
        var envoySoftwareBuildEpoch = home.data.software_build_epoch;
        var envoyIsEnvoy = (home.data.is_nonvoy == false);
        var envoyDbSize = home.data.db_size;
        var envoyDbPercentFull = home.data.db_percent_full;
        var envoyTimeZone = home.data.timezone;
        var envoyCurrentDate = home.data.current_date;
        var envoyCurrentTime = home.data.current_time;
        var envoyNetworkWebComm = home.data.network.web_comm;
        var envoyEverReportedToEnlighten = home.data.network.ever_reported_to_enlighten;
        var envoyLastEnlightenReporTime = home.data.network.last_enlighten_report_time;
        var envoyPrimaryInterface = home.data.network.primary_interface;
        var envoyTariff = home.data.tariff;
        var envoyCommNum = home.data.comm.num;
        var envoyCommLevel = home.data.comm.level;
        var envoyCommPcuNum = home.data.comm.pcu.num;
        var envoyCommPcuLevel = home.data.comm.pcu.level;
        var envoyCommAcbNum = home.data.comm.acb.num;
        var envoyCommAcbLevel = home.data.comm.acb.level;
        var envoyCommNsrbNum = home.data.comm.nsrb.num;
        var envoyCommNsrbLevel = home.data.comm.nsrb.level;
        var envoyAllerts = home.data.allerts;
        var envoyUpdateStatus = home.data.update_status;
        if (Array.isArray(envoyAllerts) && envoyAllerts.length === 1) {
          var code1 = envoyAllerts[0];
          var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
          envoyAllerts = ENVOY_STATUS_CODE_1[indexCode1];
        } else if (Array.isArray(envoyAllerts) && envoyAllerts.length === 2) {
          var code1 = envoyAllerts[0];
          var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
          var status1 = ENVOY_STATUS_CODE_1[indexCode1];
          var code2 = envoyAllerts[1];
          var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
          var status2 = ENVOY_STATUS_CODE_1[indexCode2];
          envoyAllerts = status1 + ' / ' + status2;
        } else if (Array.isArray(envoyAllerts) && envoyAllerts.length === 3) {
          var code1 = envoyAllerts[0];
          var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
          var status1 = ENVOY_STATUS_CODE_1[indexCode1];
          var code2 = envoyAllerts[1];
          var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
          var status2 = ENVOY_STATUS_CODE_1[indexCode2];
          var code3 = envoyAllerts[2];
          var indexCode3 = ENVOY_STATUS_CODE.indexOf(code3);
          var status3 = ENVOY_STATUS_CODE_1[indexCode3];
          nvoyAllerts = status1 + ' / ' + status2 + ' / ' + status3;
        } else {
          envoyAllerts = 'No allerts';
        }

        // convert energy rate
        var energyTariff = ['single_rate', 'time_to_use', 'other'];
        var energyTariffIndex = energyTariff.indexOf(envoyTariff);
        if (energyTariffIndex !== -1) {
          envoyTariff = ENERGY_TARIFF[energyTariffIndex]
        } else {
          envoyTariff = 'Undefined';
        }

        // convert network interface
        var networkInterface = ['eth0', 'wlan0', 'cellurar'];
        var networkInterfaceIndex = networkInterface.indexOf(envoyPrimaryInterface);
        envoyPrimaryInterface = NETWORK_INTERFACE[networkInterfaceIndex];

        // convert Unix time to local date time
        envoyLastEnlightenReporTime = new Date(envoyLastEnlightenReporTime * 1000).toLocaleString();

        me.log.debug('Envoy: %s', envoyIsEnvoy ? 'Yes' : 'No');
        me.log.debug('DB size: %s', envoyDbSize);
        me.log.debug('DB size percent: %s', envoyDbPercentFull);
        me.log.debug('Time Zone: %s', envoyTimeZone);
        me.log.debug('Current time: %s', envoyCurrentDate + '' + envoyCurrentTime);
        me.log.debug('Web comm:: %s', envoyNetworkWebComm);
        me.log.debug('Reported to enlighten: %s', envoyEverReportedToEnlighten);
        me.log.debug('Inverters comm: %s', envoyCommPcuNum);
        me.log.debug('Encharges comm: %s', envoyCommAcbNum);
        me.log.debug('Q-Relays comm: %s', envoyCommNsrbNum);
        me.log.debug('Allerts: %s', envoyAllerts);
        me.log.debug('Update state: %s', envoyUpdateStatus);
        me.log.debug('Last report: %s', lastrptdate);
        me.log.debug('----------------------------------');
        me.envoySoftwareBuildEpoch = envoySoftwareBuildEpoch;
        me.envoyIsEnvoy = envoyIsEnvoy;
        me.envoyDbSize = envoyDbSize;
        me.envoyDbPercentFull = envoyDbPercentFull;
        me.envoyTimeZone = envoyTimeZone;
        me.envoyCurrentDate = envoyCurrentDate;
        me.envoyCurrentTime = envoyCurrentTime;
        me.envoyNetworkWebComm = envoyNetworkWebComm;
        me.envoyEverReportedToEnlighten = envoyEverReportedToEnlighten;
        me.envoyLastEnlightenReporTime = envoyLastEnlightenReporTime;
        me.envoyPrimaryInterface = envoyPrimaryInterface;
        me.envoyTariff = envoyTariff;
        me.envoyCommNum = envoyCommNum;
        me.envoyCommLevel = envoyCommLevel;
        me.envoyCommPcuNum = envoyCommPcuNum;
        me.envoyCommPcuLevel = envoyCommPcuLevel;
        me.envoyCommAcbNum = envoyCommAcbNum;
        me.envoyCommAcbLevel = envoyCommAcbLevel;
        me.envoyCommNsrbNum = envoyCommNsrbNum;
        me.envoyCommNsrbLevel = envoyCommNsrbLevel;
        me.envoyAllerts = envoyAllerts;
        me.envoyUpdateStatus = envoyUpdateStatus;

        if (me.enphaseServiceEnvoy) {
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyAllerts, envoyAllerts);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyDbSize, envoyDbSize + ' / ' + envoyDbPercentFull + '%');
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyTariff, envoyTariff);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyPrimaryInterface, envoyPrimaryInterface);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyNetworkWebComm, envoyNetworkWebComm);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyEverReportedToEnlighten, envoyEverReportedToEnlighten);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyCommNumAndLevel, envoyCommNum + ' / ' + envoyCommLevel);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyCommNumPcuAndLevel, envoyCommPcuNum + ' / ' + envoyCommPcuLevel);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyCommNumAcbAndLevel, envoyCommAcbNum + ' / ' + envoyCommAcbLevel);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyCommNumNsrbAndLevel, envoyCommNsrbNum + ' / ' + envoyCommNsrbLevel);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyTimeZone, envoyTimeZone);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyCurrentDateTime, envoyCurrentDate + ' ' + envoyCurrentTime);
          me.enphaseServiceEnvoy.updateCharacteristic(Characteristic.enphaseEnvoyLastEnlightenReporTime, envoyLastEnlightenReporTime);
        }
        me.envoyDataOK = true;
      }

      //qrelays
      if (me.qRelaysCount > 0) {
        const inventory = await axios.get(me.url + INVENTORY_URL);
        for (let i = 0; i < me.qRelaysCount; i++) {
          if (inventory.status == 200) {
            var type = inventory.data[2].type;
            var serialNumber = inventory.data[2].devices[i].serial_num;
            var firmware = inventory.data[2].devices[i].img_pnum_running;
            var lastrptdate = inventory.data[2].devices[i].last_rpt_date;
            var relay = inventory.data[2].devices[i].relay;
            var producing = inventory.data[2].devices[i].producing;
            var communicating = inventory.data[2].devices[i].communicating;
            var provisioned = inventory.data[2].devices[i].provisioned;
            var operating = inventory.data[2].devices[i].operating;
            var linesCount = inventory.data[2].devices[i]['line-count'];
            if (linesCount >= 1) {
              var line1Connected = inventory.data[2].devices[i]['line1-connected'];
              if (linesCount >= 2) {
                var line2Connected = inventory.data[2].devices[i]['line2-connected'];
                if (linesCount >= 3) {
                  var line3Connected = inventory.data[2].devices[i]['line3-connected'];
                }
              }
            }

            var status = inventory.data[2].devices[i].device_status;
            if (Array.isArray(status) && status.length === 1) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              status = ENVOY_STATUS_CODE_1[indexCode1];
            } else if (Array.isArray(status) && status.length === 2) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              status = status1 + ' / ' + status2;
            } else if (Array.isArray(status) && status.length === 3) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              var code3 = status[2];
              var indexCode3 = ENVOY_STATUS_CODE.indexOf(code3);
              var status3 = ENVOY_STATUS_CODE_1[indexCode3];
              status = status1 + ' / ' + status2 + ' / ' + status3;
            } else {
              status = 'Status not available';
            }

            // convert Unix time to local date time
            lastrptdate = new Date(lastrptdate * 1000).toLocaleString();

            me.log.debug('Q-Relay: %s', serialNumber);
            me.log.debug('Type %s:', type);
            me.log.debug('Firmware: %s', firmware);
            me.log.debug('Relay: %s', relay);
            me.log.debug('Producing: %s', producing ? 'Yes' : 'No');
            me.log.debug('Communicating: %s', communicating ? 'Yes' : 'No');
            me.log.debug('Provisioned: %s', provisioned ? 'Yes' : 'No');
            me.log.debug('Operating: %s', operating ? 'Yes' : 'No');
            me.log.debug('Lines count: %s', linesCount);
            if (linesCount >= 1) {
              me.log.debug('Line 1: %s', line1Connected ? 'Closed' : 'Open');
              if (linesCount >= 2) {
                me.log.debug('Line 2: %s', line2Connected ? 'Closed' : 'Open');
                if (linesCount >= 3) {
                  me.log.debug('Line 3: %s', line3Connected ? 'Closed' : 'Open');
                }
              }
            }
            me.log.debug('Status: %s', status ? 'Yes' : 'No');
            me.log.debug('Last report: %s', lastrptdate);
            me.log.debug('----------------------------------');
            me.qRelaysSerialNumber.push(serialNumber);
            me.qRelaysRelay.push(relay);
            me.qRelaysProducing.push(producing);
            me.qRelaysCommunicating.push(communicating);
            me.qRelaysProvisioned.push(provisioned);
            me.qRelaysOperating.push(operating);
            me.qRelaysLinesCount.push(linesCount);
            if (linesCount >= 1) {
              me.qRelaysLine1Connected.push(line1Connected);
              if (linesCount >= 2) {
                me.qRelaysLine2Connected.push(line2Connected);
                if (linesCount >= 3) {
                  me.qRelaysLine3Connected.push(line3Connected);
                }
              }
            }
            me.qRelaysStatus.push(status);
            me.qRelaysFirmware.push(firmware);
            me.qRelaysLastReportDate.push(lastrptdate);

            if (me.enphaseServiceQrelay) {
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayState, relay);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayLinesCount, linesCount);
              if (linesCount >= 1) {
                me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayLine1Connected, line1Connected);
                if (linesCount >= 2) {
                  me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayLine2Connected, line2Connected);
                  if (linesCount >= 3) {
                    me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayLine3Connected, line3Connected);
                  }
                }
              }
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayProducing, producing);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayCommunicating, communicating);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayProvisioned, provisioned);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayOperating, operating);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayStatus, status);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayFirmware, firmware);
              me.enphaseServiceQrelay.updateCharacteristic(Characteristic.enphaseQrelayLastReportDate, lastrptdate);
            }
            me.qrelaysDataOK = true;
          }
        }
      }

      //meters
      if (me.metersCount > 0) {
        const meters = await axios.get(me.url + METERS_URL);
        for (let i = 0; i < me.metersCount; i++) {
          if (meters.status == 200) {
            var eid = meters.data[i].eid;
            var state = meters.data[i].state;
            var measurementType = meters.data[i].measurementType;
            var phaseMode = meters.data[i].phaseMode;
            var phaseCount = meters.data[i].phaseCount;
            var meteringStatus = meters.data[i].meteringStatus;
            var status = meters.data[i].statusFlags;
            if (Array.isArray(status) && status.length === 1) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              status = ENVOY_STATUS_CODE_1[indexCode1];
            } else if (Array.isArray(status) && status.length === 2) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              status = status1 + ' / ' + status2;
            } else if (Array.isArray(status) && status.length === 3) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              var code3 = status[2];
              var indexCode3 = ENVOY_STATUS_CODE.indexOf(code3);
              var status3 = ENVOY_STATUS_CODE_1[indexCode3];
              status = status1 + ' / ' + status2 + ' / ' + status3;
            } else {
              status = 'Status not available';
            }
            me.log.debug('Meter %s:', measurementType);
            me.log.debug('State: %s', state);
            me.log.debug('Phase mode: %s', phaseMode);
            me.log.debug('Phase count: %s', phaseCount);
            me.log.debug('Metering status: %s', meteringStatus);
            me.log.debug('Status flag: %s', status);
            me.log.debug('----------------------------------');
            me.metersEid.push(eid);
            me.metersState.push(state);
            me.metersMeasurementType.push(measurementType);
            me.metersPhaseMode.push(phaseMode);
            me.metersPhaseCount.push(phaseCount);
            me.metersMeteringStatus.push(meteringStatus);
            me.metersStatusFlags.push(status);

            if (me.enphaseServiceMeter) {
              me.enphaseServiceMeter.updateCharacteristic(Characteristic.enphaseMetersState, state);
              me.enphaseServiceMeter.updateCharacteristic(Characteristic.enphaseMetersPhaseMode, phaseMode);
              me.enphaseServiceMeter.updateCharacteristic(Characteristic.enphaseMetersPhaseCount, phaseCount);
              me.enphaseServiceMeter.updateCharacteristic(Characteristic.enphaseMetersMeteringStatus, meteringStatus);
              me.enphaseServiceMeter.updateCharacteristic(Characteristic.enphaseMetersStatusFlags, status);
            }
            me.metersDataOK = true;
          }
        }
      }

      //encharge storage
      if (me.enchargesCount > 0) {
        const inventory = await axios.get(me.url + INVENTORY_URL);
        for (let i = 0; i < me.enchargesCount; i++) {
          if (inventory.status == 200) {
            var type = inventory.data[1].type;
            var serialNumber = inventory.data[1].devices[i].serial_num;
            var firmware = inventory.data[1].devices[i].img_pnum_running;
            var lastrptdate = inventory.data[1].devices[i].last_rpt_date;
            var producing = inventory.data[1].devices[i].producing;
            var communicating = inventory.data[1].devices[i].communicating;
            var provisioned = inventory.data[1].devices[i].provisioned;
            var operating = inventory.data[1].devices[i].operating;
            var status = inventory.data[1].devices[i].device_status;
            if (Array.isArray(status) && status.length === 1) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              status = ENVOY_STATUS_CODE_1[indexCode1];
            } else if (Array.isArray(status) && status.length === 2) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              status = status1 + ' / ' + status2;
            } else if (Array.isArray(status) && status.length === 3) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              var code3 = status[2];
              var indexCode3 = ENVOY_STATUS_CODE.indexOf(code3);
              var status3 = ENVOY_STATUS_CODE_1[indexCode3];
              status = status1 + ' / ' + status2 + ' / ' + status3;
            } else {
              status = 'Status not available';
            }
            // convert Unix time to local date time
            lastrptdate = new Date(lastrptdate * 1000).toLocaleString();

            me.log.debug('Encharge %s:', serialNumber);
            me.log.debug('Type %s:', type);
            me.log.debug('Firmware %s:', firmware);
            me.log.debug('Producing: %s', producing ? 'Yes' : 'No');
            me.log.debug('Communicating: %s', communicating ? 'Yes' : 'No');
            me.log.debug('Provisioned: %s', provisioned ? 'Yes' : 'No');
            me.log.debug('Operating: %s', operating ? 'Yes' : 'No');
            me.log.debug('Status: %s', status);
            me.log.debug('Last report: %s', lastrptdate);
            me.log.debug('----------------------------------');

            me.enchargesSerialNumber.push(serialNumber);
            me.enchargesFirmware.push(firmware);
            me.enchargesProducing.push(producing);
            me.enchargesCommunicating.push(communicating);
            me.enchargesProvisioned.push(provisioned);
            me.enchargesOperating.push(operating);
            me.enchargesStatus.push(status);
            me.enchargesLastReportDate.push(lastrptdate);

            if (me.enphaseServiceEncharge) {
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeProducing, producing);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeCommunicating, communicating);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeProvisioned, provisioned);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeOperating, operating);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeStatus, status);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeFirmware, firmware);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeLastReportDate, lastrptdate);
            }
            me.enchargesDataOK = true;
          }

          if (productionCT.status == 200) {
            var enchargeType = productionCT.data.storage[i].type;
            var enchargeActiveCount = productionCT.data.storage[i].activeCount;
            var enchargewNow = parseFloat((productionCT.data.storage[i].wNow) / 1000);
            var enchargewhNow = parseFloat((productionCT.data.storage[i].whNow + me.enchargeStorageOffset) / 1000);
            var enchargeState = productionCT.data.storage[i].state;

            me.log.debug('Type: %s kW', me.host, me.name, enchargeType);
            me.log.debug('Active count: %s kW', me.host, me.name, enchargeActiveCount);
            me.log.debug('Power: %s kW', me.host, me.name, enchargewNow);
            me.log.debug('Energy: %s kWh', me.host, me.name, enchargewhNow);
            me.log.debug('State: %s', enchargeState);
            me.log.debug('----------------------------------');

            me.enchargeType.push(enchargeType);
            me.enchargeActiveCount.push(enchargeActiveCount);
            me.enchargesPower.push(enchargewNow);
            me.enchargesEnergy.push(enchargewhNow);
            me.enchargesState.push(enchargeState);

            if (me.enphaseServiceEncharge) {
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargePower, enchargewNow);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeEnergyToday, enchargewhNow);
              me.enphaseServiceEncharge.updateCharacteristic(Characteristic.enphaseEnchargeState, enchargeState);
            }
            me.enchargesDataOK1 = true;
          }
        }
      }

      //microinverters power
      if (me.invertersCount > 0) {
        const inventory = await axios.get(me.url + INVENTORY_URL);
        if (inventory.status == 200) {
          for (let i = 0; i < me.invertersCount; i++) {
            var type = inventory.data[0].type;
            var serialNumber = inventory.data[0].devices[i].serial_num;
            var firmware = inventory.data[0].devices[i].img_pnum_running;
            var lastrptdate = inventory.data[0].devices[i].last_rpt_date;
            var producing = inventory.data[0].devices[i].producing;
            var communicating = inventory.data[0].devices[i].communicating;
            var provisioned = inventory.data[0].devices[i].provisioned;
            var operating = inventory.data[0].devices[i].operating;
            var status = inventory.data[0].devices[i].device_status;
            if (Array.isArray(status) && status.length === 1) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              status = ENVOY_STATUS_CODE_1[indexCode1];
            } else if (Array.isArray(status) && status.length === 2) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              status = status1 + ' / ' + status2;
            } else if (Array.isArray(status) && status.length === 3) {
              var code1 = status[0];
              var indexCode1 = ENVOY_STATUS_CODE.indexOf(code1);
              var status1 = ENVOY_STATUS_CODE_1[indexCode1];
              var code2 = status[1];
              var indexCode2 = ENVOY_STATUS_CODE.indexOf(code2);
              var status2 = ENVOY_STATUS_CODE_1[indexCode2];
              var code3 = status[2];
              var indexCode3 = ENVOY_STATUS_CODE.indexOf(code3);
              var status3 = ENVOY_STATUS_CODE_1[indexCode3];
              status = status1 + ' / ' + status2 + ' / ' + status3;
            } else {
              status = 'Status not available';
            }

            // convert Unix time to local date time
            lastrptdate = new Date(lastrptdate * 1000).toLocaleString();

            me.log.debug('Inverter %s:', serialNumber);
            me.log.debug('Type %s:', type);
            me.log.debug('Firmware %s:', firmware);
            me.log.debug('Producing: %s', producing ? 'Yes' : 'No');
            me.log.debug('Communicating: %s', communicating ? 'Yes' : 'No');
            me.log.debug('Provisioned: %s', provisioned ? 'Yes' : 'No');
            me.log.debug('Operating: %s', operating ? 'Yes' : 'No');
            me.log.debug('Status: %s', status);
            me.log.debug('Last report: %s', lastrptdate);
            me.log.debug('----------------------------------');
            me.invertersSerialNumber.push(serialNumber);
            me.invertersFirmware.push(firmware);
            me.invertersProducing.push(producing);
            me.invertersCommunicating.push(communicating);
            me.invertersProvisioned.push(provisioned);
            me.invertersOperating.push(operating);
            me.invertersStatus.push(status);
            //me.invertersLastReportDate.push(lastrptdate);

            if (me.enphaseServiceMicronverter) {
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterProducing, producing);
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterCommunicating, communicating);
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterProvisioned, provisioned);
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterOperating, operating);
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterStatus, status);
              me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterFirmware, firmware);
              //me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseLastReportDate, lastrptdate);
            }
          }
          me.invertersDataOK = true;
        }
        if (me.invertersDataOK) {
          const user = me.envoyUser;
          const passwd = me.envoySerialNumber.substring(6);
          const auth = user + ':' + passwd;
          const url = me.url + PRODUCTION_INVERTERS_URL;
          const options = {
            method: 'GET',
            rejectUnauthorized: false,
            digestAuth: auth,
            headers: {
              'Content-Type': 'application/json'
            }
          };

          const response = await http.request(url, options);
          const inverters = JSON.parse(response.data);
          if (inverters !== 'undefined') {
            var invertersCount = inverters.length;
            var arr = new Array();
            for (let i = 0; i < invertersCount; i++) {
              var serialNumber = inverters[i].serialNumber;
              arr.push(serialNumber);
            }
            for (let i = 0; i < me.invertersCount; i++) {
              var index = arr.indexOf(me.invertersSerialNumber[i]);
              var inverterLastReportDate = inverters[index].lastReportDate;
              var inverterType = inverters[index].devType;
              var inverterLastPower = parseFloat(inverters[index].lastReportWatts);
              var inverterMaxPower = parseFloat(inverters[index].maxReportWatts);

              // convert Unix time to local date time
              inverterLastReportDate = new Date(inverterLastReportDate * 1000).toLocaleString();

              me.log.debug('Device: %s %s, inverter: %s type: %s', me.host, me.name, me.invertersSerialNumber[i], inverterType);
              me.log.debug('Device: %s %s, inverter: %s last power: %s W', me.host, me.name, me.invertersSerialNumber[i], inverterLastPower);
              me.log.debug('Device: %s %s, inverter: %s max power: %s W', me.host, me.name, me.invertersSerialNumber[i], inverterMaxPower);
              me.log.debug('Device: %s %s, inverter: %s last report: %s', me.host, me.name, me.invertersSerialNumber[i], inverterLastReportDate);
              me.invertersLastReportDate.push(inverterLastReportDate);
              me.invertersType.push(inverterType);
              me.invertersLastPower.push(inverterLastPower);
              me.invertersMaxPower.push(inverterMaxPower);

              if (me.enphaseServiceMicronverter) {
                me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterPower, inverterLastPower);
                me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterPowerMax, inverterMaxPower);
                me.enphaseServiceMicronverter.updateCharacteristic(Characteristic.enphaseMicroinverterLastReportDate, inverterLastReportDate);
              }
            }
            me.invertersDataOK1 = true;
          }
        }
      }
      if (!me.checkDeviceState) {
        me.prepareAccessory();
      }
      me.checkDeviceState = true;
    } catch (error) {
      me.log.error('Device: %s %s, update Device state error: %s, state: Offline', me.host, me.name, error);
      me.checkDeviceState = false;
      me.checkDeviceInfo = true;
    }
  }

  //Prepare accessory
  prepareAccessory() {
    this.log.debug('prepareAccessory');
    const accessoryName = this.name;
    const accessoryUUID = UUID.generate(accessoryName);
    const accessoryCategory = Categories.OTHER;
    this.accessory = new Accessory(accessoryName, accessoryUUID, accessoryCategory);

    this.prepareInformationService();
    this.prepareEnphaseService();

    this.log.debug('Device: %s %s, publishExternalAccessories.', this.host, accessoryName);
    this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
  }

  //Prepare information service
  prepareInformationService() {
    this.log.debug('prepareInformationService');

    let manufacturer = this.manufacturer;
    let modelName = this.modelName;
    let serialNumber = this.envoySerialNumber;
    let firmwareRevision = this.envoyFirmware;

    this.accessory.removeService(this.accessory.getService(Service.AccessoryInformation));
    const informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, manufacturer)
      .setCharacteristic(Characteristic.Model, modelName)
      .setCharacteristic(Characteristic.SerialNumber, serialNumber)
      .setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision);

    this.accessory.addService(informationService);
  }

  //Prepare TV service 
  prepareEnphaseService() {
    this.log.debug('prepareEnphaseService');
    //power and energy production
    if (this.productionDataOK) {
      this.enphaseServiceProduction = new Service.enphasePowerEnergyMeter('Production', 'enphaseServiceProduction');
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphasePower)
        .on('get', (callback) => {
          let value = this.powerProduction;
          this.log.info('Device: %s %s, power production: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphasePowerMax)
        .on('get', (callback) => {
          let value = this.powerProductionMax;
          this.log.info('Device: %s %s, power production max: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphasePowerMaxDetected)
        .on('get', (callback) => {
          let value = this.powerProductionMaxDetectedState;
          this.log.info('Device: %s %s, power production max detected: %s', this.host, this.name, value ? 'Yes' : 'No');
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphaseEnergyToday)
        .on('get', (callback) => {
          let value = this.energyProductionToday;
          this.log.info('Device: %s %s, energy production Today: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphaseEnergyLastSevenDays)
        .on('get', (callback) => {
          let value = this.energyProductionLastSevenDays;
          this.log.info('Device: %s %s, energy production Last Seven Days: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphaseEnergyLifetime)
        .on('get', (callback) => {
          let value = this.energyProductionLifetime;
          this.log.info('Device: %s %s, energy production Lifetime: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceProduction.getCharacteristic(Characteristic.enphaseLastReportDate)
        .on('get', (callback) => {
          let value = this.productionLastReportDate;
          this.log.info('Device: %s %s, last report: %s', this.host, this.name, value);
          callback(null, value);
        });
      this.accessory.addService(this.enphaseServiceProduction);
    }

    //power and energy consumption total
    if (this.metersCount > 0 && this.metersConsumtionTotalActiveCount > 0 && this.consumptionTotalDataOK) {
      this.enphaseServiceConsumptionTotal = new Service.enphasePowerEnergyMeter('Consumption Total', 'enphaseServiceConsumptionTotal');
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphasePower)
        .on('get', (callback) => {
          let value = this.powerConsumptionTotal;
          this.log.info('Device: %s %s, power consumption total: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphasePowerMax)
        .on('get', (callback) => {
          let value = this.powerConsumptionTotalMax;
          this.log.info('Device: %s %s, power consumption total max: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphasePowerMaxDetected)
        .on('get', (callback) => {
          let value = this.powerConsumptionTotalMaxDetectedState;
          this.log.info('Device: %s %s, power consumption total max detected: %s', this.host, this.name, value ? 'Yes' : 'No');
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphaseEnergyToday)
        .on('get', (callback) => {
          let value = this.energyConsumptionTotalToday;
          this.log.info('Device: %s %s, energy consumption total Today: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphaseEnergyLastSevenDays)
        .on('get', (callback) => {
          let value = this.energyConsumptionTotalLastSevenDays;
          this.log.info('Device: %s %s, energy consumption total Last Seven Days: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphaseEnergyLifetime)
        .on('get', (callback) => {
          let value = this.energyConsumptionTotalLifetime;
          this.log.info('Device: %s %s, energy consumption total Lifetime: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionTotal.getCharacteristic(Characteristic.enphaseLastReportDate)
        .on('get', (callback) => {
          let value = this.totalConsumptionLastReportDate;
          this.log.info('Device: %s %s, last report: %s', this.host, this.name, value);
          callback(null, value);
        });
      this.accessory.addService(this.enphaseServiceConsumptionTotal);
    }

    //power and energy consumption net
    if (this.metersCount > 0 && this.metersConsumptionNetActiveCount > 0 && this.consumptionNetDataOK) {
      this.enphaseServiceConsumptionNet = new Service.enphasePowerEnergyMeter('Consumption Net', 'enphaseServiceConsumptionNet');
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphasePower)
        .on('get', (callback) => {
          let value = this.powerConsumptionNet;
          this.log.info('Device: %s %s, power consumption net: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphasePowerMax)
        .on('get', (callback) => {
          let value = this.powerConsumptionNetMax;
          this.log.info('Device: %s %s, power consumption net max: %s kW', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphasePowerMaxDetected)
        .on('get', (callback) => {
          let value = this.powerConsumptionNetMaxDetectedState;
          this.log.info('Device: %s %s, power consumption net max detected: %s', this.host, this.name, value ? 'Yes' : 'No');
          callback(null, value);
        });
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphaseEnergyToday)
        .on('get', (callback) => {
          let value = this.energyConsumptionNetToday;
          this.log.info('Device: %s %s, energy consumption net Today: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphaseEnergyLastSevenDays)
        .on('get', (callback) => {
          let value = this.energyConsumptionNetLastSevenDays;
          this.log.info('Device: %s %s, energy consumption net Last Seven Days: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        });
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphaseEnergyLifetime)
        .on('get', (callback) => {
          let value = this.energyConsumptionNetLifetime;
          this.log.info('Device: %s %s, energy consumption net Lifetime: %s kWh', this.host, this.name, value.toFixed(3));
          callback(null, value);
        })
      this.enphaseServiceConsumptionNet.getCharacteristic(Characteristic.enphaseLastReportDate)
        .on('get', (callback) => {
          let value = this.netConsumptionLastReportDate;
          this.log.info('Device: %s %s, last report: %s', this.host, this.name, value);
          callback(null, value);
        });
      this.accessory.addService(this.enphaseServiceConsumptionNet);
    }

    //envoy
    if (this.envoyDataOK) {
      this.enphaseServiceEnvoy = new Service.enphaseEnvoy('Envoy ' + this.envoySerialNumber, 'enphaseServiceEnvoy');
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyAllerts)
        .on('get', (callback) => {
          let value = this.envoyAllerts;
          this.log.info('Device: %s %s, envoy: %s allerts: %s', this.host, this.name, this.envoySerialNumber, value);
          if (value.length > 64) {
            value = value.substring(0, 64)
          }
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyDbSize)
        .on('get', (callback) => {
          let value = this.envoyDbSize + ' / ' + this.envoyDbPercentFull + '%';
          this.log.info('Device: %s %s, envoy: %s db size: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyTariff)
        .on('get', (callback) => {
          let value = this.envoyTariff;
          this.log.info('Device: %s %s, envoy: %s tariff: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyPrimaryInterface)
        .on('get', (callback) => {
          let value = this.envoyPrimaryInterface;
          this.log.info('Device: %s %s, envoy: %s network interface: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyNetworkWebComm)
        .on('get', (callback) => {
          let value = this.envoyNetworkWebComm;
          this.log.info('Device: %s %s, envoy: %s web communication: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyEverReportedToEnlighten)
        .on('get', (callback) => {
          let value = this.envoyEverReportedToEnlighten;
          this.log.info('Device: %s %s, envoy: %s report to enlighten: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyCommNumAndLevel)
        .on('get', (callback) => {
          let value = this.envoyCommNum + ' / ' + this.envoyCommLevel;
          this.log.info('Device: %s %s, envoy: %s communication devices and level: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyCommNumPcuAndLevel)
        .on('get', (callback) => {
          let value = this.envoyCommPcuNum + ' / ' + this.envoyCommPcuLevel;
          this.log.info('Device: %s %s, envoy: %s communication Microinverters and level: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyCommNumAcbAndLevel)
        .on('get', (callback) => {
          let value = this.envoyCommAcbNum + ' / ' + this.envoyCommAcbLevel;
          this.log.info('Device: %s %s, envoy: %s communication Encharges and level %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyCommNumNsrbAndLevel)
        .on('get', (callback) => {
          let value = this.envoyCommNsrbNum + ' / ' + this.envoyCommNsrbLevel;
          this.log.info('Device: %s %s, envoy: %s communication qRelays and level: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyUpdateStatus)
        .on('get', (callback) => {
          let value = this.envoyUpdateStatus;
          this.log.info('Device: %s %s, envoy: %s update status: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyTimeZone)
        .on('get', (callback) => {
          let value = this.envoyTimeZone;
          this.log.info('Device: %s %s, envoy: %s time zone: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyCurrentDateTime)
        .on('get', (callback) => {
          let value = this.envoyCurrentDate + ' ' + this.envoyCurrentTime;
          this.log.info('Device: %s %s, envoy: %s current date and time: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.enphaseServiceEnvoy.getCharacteristic(Characteristic.enphaseEnvoyLastEnlightenReporTime)
        .on('get', (callback) => {
          let value = this.envoyLastEnlightenReporTime;
          this.log.info('Device: %s %s, envoy: %s last report to enlighten: %s', this.host, this.name, this.envoySerialNumber, value);
          callback(null, value);
        });
      this.accessory.addService(this.enphaseServiceEnvoy);
    }

    //qrelay
    if (this.qRelaysCount > 0 && this.qrelaysDataOK) {
      for (let i = 0; i < this.qRelaysCount; i++) {
        this.enphaseServiceQrelay = new Service.enphaseQrelay('Q-Relay ' + this.qRelaysSerialNumber[i], 'enphaseServiceQrelay' + i);
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayState)
          .on('get', (callback) => {
            let value = this.qRelaysRelay[i];
            this.log.info('Device: %s %s, qrelay: %s relay: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Closed' : 'Open');
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayLinesCount)
          .on('get', (callback) => {
            let value = this.qRelaysLinesCount[i];
            this.log.info('Device: %s %s, qrelay: %s lines: %s', this.host, this.name, this.qRelaysSerialNumber[i], value);
            callback(null, value);
          });
        if (this.qRelaysLinesCount[i] >= 1) {
          this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayLine1Connected)
            .on('get', (callback) => {
              let value = this.qRelaysLine1Connected[i];
              this.log.info('Device: %s %s, qrelay: %s line 1: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Closed' : 'Open');
              callback(null, value);
            });
          if (this.qRelaysLinesCount[i] >= 2) {
            this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayLine2Connected)
              .on('get', (callback) => {
                let value = this.qRelaysLine2Connected[i];
                this.log.info('Device: %s %s, qrelay: %s line 2: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Closed' : 'Open');
                callback(null, value);
              });
            if (this.qRelaysLinesCount[i] >= 3) {
              this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayLine3Connected)
                .on('get', (callback) => {
                  let value = this.qRelaysLine3Connected[i];
                  this.log.info('Device: %s %s, qrelay: %s line 3: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Closed' : 'Open');
                  callback(null, value);
                });
            }
          }
        }
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayProducing)
          .on('get', (callback) => {
            let value = this.qRelaysProducing[i];
            this.log.info('Device: %s %s, qrelay: %s producing: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Yes' : 'No');
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayCommunicating)
          .on('get', (callback) => {
            let value = this.qRelaysCommunicating[i];
            this.log.info('Device: %s %s, qrelay: %s communicating: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Yes' : 'No');
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayProvisioned)
          .on('get', (callback) => {
            let value = this.qRelaysProvisioned[i];
            this.log.info('Device: %s %s, qrelay: %s provisioned: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Yes' : 'No');
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayOperating)
          .on('get', (callback) => {
            let value = this.qRelaysOperating[i];
            this.log.info('Device: %s %s, qrelay: %s operating: %s', this.host, this.name, this.qRelaysSerialNumber[i], value ? 'Yes' : 'No');
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayStatus)
          .on('get', (callback) => {
            let value = this.qRelaysStatus[i];
            if (value.length > 64) {
              value = value.substring(0, 64)
            }
            this.log.info('Device: %s %s, qrelay: %s status: %s', this.host, this.name, this.qRelaysSerialNumber[i], value);
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayFirmware)
          .on('get', (callback) => {
            let value = this.qRelaysFirmware[i];
            this.log.info('Device: %s %s, qrelay: %s firmware: %s', this.host, this.name, this.qRelaysSerialNumber[i], value);
            if (value.length > 64) {
              value = value.substring(0, 64)
            }
            callback(null, value);
          });
        this.enphaseServiceQrelay.getCharacteristic(Characteristic.enphaseQrelayLastReportDate)
          .on('get', (callback) => {
            let value = this.qRelaysLastReportDate[i];
            this.log.info('Device: %s %s, qrelay: %s last report: %s', this.host, this.name, this.qRelaysSerialNumber[i], value);
            callback(null, value);
          });
        this.accessory.addService(this.enphaseServiceQrelay);
      }
    }

    //meters
    if (this.metersCount > 0 && this.metersDataOK) {
      for (let i = 0; i < this.metersCount; i++) {
        this.enphaseServiceMeter = new Service.enphaseMeters('Meter ' + this.metersMeasurementType[i], 'enphaseServiceMeter' + i);
        this.enphaseServiceMeter.getCharacteristic(Characteristic.enphaseMetersState)
          .on('get', (callback) => {
            let value = this.metersState[i];
            this.log.info('Device: %s %s, meter: %s state: %s', this.host, this.name, this.metersMeasurementType[i], value);
            callback(null, value);
          });
        this.enphaseServiceMeter.getCharacteristic(Characteristic.enphaseMetersPhaseMode)
          .on('get', (callback) => {
            let value = this.metersPhaseMode[i];
            this.log.info('Device: %s %s, meter: %s phase mode: %s', this.host, this.name, this.metersMeasurementType[i], value);
            callback(null, value);
          });
        this.enphaseServiceMeter.getCharacteristic(Characteristic.enphaseMetersPhaseCount)
          .on('get', (callback) => {
            let value = this.metersPhaseCount[i];
            this.log.info('Device: %s %s, meter: %s phase count: %s', this.host, this.name, this.metersMeasurementType[i], value);
            callback(null, value);
          });
        this.enphaseServiceMeter.getCharacteristic(Characteristic.enphaseMetersMeteringStatus)
          .on('get', (callback) => {
            let value = this.metersMeteringStatus[i];
            this.log.info('Device: %s %s, meter: %s metering status: %s', this.host, this.name, this.metersMeasurementType[i], value);
            callback(null, value);
          });
        this.enphaseServiceMeter.getCharacteristic(Characteristic.enphaseMetersStatusFlags)
          .on('get', (callback) => {
            let value = this.metersStatusFlags[i];
            this.log.info('Device: %s %s, meter: %s status flag: %s', this.host, this.name, this.metersMeasurementType[i], value);
            callback(null, value);
          });
        this.accessory.addService(this.enphaseServiceMeter);
      }
    }

    //encharge storage
    if (this.encharge > 0) {
      for (let i = 0; i < this.encharge; i++) {
        if (this.enchargesDataOK1) {
          this.enphaseServiceEncharge = new Service.enphaseEncharge('Encharge storage', + this.enchargesSerialNumber[i], 'enphaseServiceEncharge' + i);
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargePower)
            .on('get', (callback) => {
              let value = this.enchargesPower[i];
              this.log.info('Device: %s %s, power encharge %s storage: %s kW', this.host, this.name, this.enchargesSerialNumber[i], value.toFixed(3));
              callback(null, value);
            })
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeEnergy)
            .on('get', (callback) => {
              let value = this.enchargesPower[i];
              this.log.info('Device: %s %s, energy encharge %s storage: %s kWh', this.host, this.name, this.enchargesSerialNumber[i], value.toFixed(3));
              callback(null, value);
            })
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeState)
            .on('get', (callback) => {
              let value = this.enchargesState[i];
              this.log.info('Device: %s %s, encharge: %s state: %s', this.host, this.name, this.enchargesSerialNumber[i], value);
              callback(null, value);
            });
        }
        if (this.enchargesDataOK) {
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeProducing)
            .on('get', (callback) => {
              let value = this.enchargesProducing[i];
              this.log.info('Device: %s %s, encharge: %s producing: %s', this.host, this.name, this.enchargesSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeCommunicating)
            .on('get', (callback) => {
              let value = this.enchargesCommunicating[i];
              this.log.info('Device: %s %s, encharge: %s communicating: %s', this.host, this.name, this.enchargesSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeProvisioned)
            .on('get', (callback) => {
              let value = this.enchargesProvisioned[i];
              this.log.info('Device: %s %s, encharge: %s provisioned: %s', this.host, this.name, this.enchargesSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeOperating)
            .on('get', (callback) => {
              let value = this.enchargesOperating[i];
              this.log.info('Device: %s %s, encharge: %s operating: %s', this.host, this.name, this.enchargesSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeStatus)
            .on('get', (callback) => {
              let value = this.enchargesStatus[i];
              this.log.info('Device: %s %s, encharge: %s status: %s', this.host, this.name, this.enchargesSerialNumber[i], value);
              if (value.length > 64) {
                value = value.substring(0, 64)
              }
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeFirmware)
            .on('get', (callback) => {
              let value = this.enchargesFirmware[i];
              this.log.info('Device: %s %s, encharge: %s firmware: %s', this.host, this.name, this.enchargesSerialNumber[i], value);
              if (value.length > 64) {
                value = value.substring(0, 64)
              }
              callback(null, value);
            });
          this.enphaseServiceEncharge.getCharacteristic(Characteristic.enphaseEnchargeLastReportDate)
            .on('get', (callback) => {
              let value = this.enchargesLastReportDate[i];
              this.log.info('Device: %s %s, encharge: %s last report: %s', this.host, this.name, this.enchargesSerialNumber[i], value);
              callback(null, value);
            });
          this.accessory.addService(this.enphaseServiceEncharge);
        }
      }
    }

    //microinverter
    if (this.invertersCount > 0) {
      for (let i = 0; i < this.invertersCount; i++) {
        if (this.invertersDataOK1) {
          this.enphaseServiceMicronverter = new Service.enphaseMicroinverter('Microinverter ' + this.invertersSerialNumber[i], 'enphaseServiceMicronverter' + i);
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterPower)
            .on('get', (callback) => {
              let value = this.invertersLastPower[i];
              this.log.info('Device: %s %s, inverter: %s last power: %s W', this.host, this.name, this.invertersSerialNumber[i], value.toFixed(0));
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterPowerMax)
            .on('get', (callback) => {
              let value = this.invertersMaxPower[i];
              this.log.info('Device: %s %s, inverter: %s max power: %s W', this.host, this.name, this.invertersSerialNumber[i], value.toFixed(0));
              callback(null, value);
            });
        }
        if (this.invertersDataOK) {
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterProducing)
            .on('get', (callback) => {
              let value = this.invertersProducing[i];
              this.log.info('Device: %s %s, inverter: %s producing: %s', this.host, this.name, this.invertersSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterCommunicating)
            .on('get', (callback) => {
              let value = this.invertersCommunicating[i];
              this.log.info('Device: %s %s, inverter: %s communicating: %s', this.host, this.name, this.invertersSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterProvisioned)
            .on('get', (callback) => {
              let value = this.invertersProvisioned[i];
              this.log.info('Device: %s %s, inverter: %s provisioned: %s', this.host, this.name, this.invertersSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterOperating)
            .on('get', (callback) => {
              let value = this.invertersOperating[i];
              this.log.info('Device: %s %s, inverter: %s operating: %s', this.host, this.name, this.invertersSerialNumber[i], value ? 'Yes' : 'No');
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterStatus)
            .on('get', (callback) => {
              let value = this.invertersStatus[i];
              this.log.info('Device: %s %s, inverter: %s status: %s', this.host, this.name, this.invertersSerialNumber[i], value);
              if (value.length > 64) {
                value = value.substring(0, 64)
              }
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterFirmware)
            .on('get', (callback) => {
              let value = this.invertersFirmware[i];
              this.log.info('Device: %s %s, inverter: %s firmware: %s', this.host, this.name, this.invertersSerialNumber[i], value);
              if (value.length > 64) {
                value = value.substring(0, 64)
              }
              callback(null, value);
            });
          this.enphaseServiceMicronverter.getCharacteristic(Characteristic.enphaseMicroinverterLastReportDate)
            .on('get', (callback) => {
              let value = this.invertersLastReportDate[i];
              this.log.info('Device: %s %s, inverter: %s last report: %s', this.host, this.name, this.invertersSerialNumber[i], value);
              callback(null, value);
            });
        }
        this.accessory.addService(this.enphaseServiceMicronverter);
      }
    }
  }
}

