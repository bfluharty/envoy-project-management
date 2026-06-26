const OasModule = require('oas')
const APICoreModule = require('api/dist/core')
const definition = require('./openapi.json')

const Oas = OasModule.default ?? OasModule
const APICore = APICoreModule.default ?? APICoreModule

class SDK {
  constructor() {
    this.spec = Oas.init(definition)
    this.core = new APICore(this.spec, 'fsq-developers-places/20250617 (api/6.1.3)')
  }

  config(config) {
    this.core.setConfig(config)
  }

  auth(...values) {
    this.core.setAuth(...values)
    return this
  }

  server(url, variables = {}) {
    this.core.setServer(url, variables)
  }

  placeSearch(metadata) {
    return this.core.fetch('/places/search', 'get', metadata)
  }
}

module.exports = new SDK()
