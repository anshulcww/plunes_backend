const mongoose = require('mongoose')
const fs = require('fs')

const ObjectId = mongoose.Types.ObjectId

const servicesSchema = mongoose.Schema({
    speciality: String,
    specialityId: ObjectId,
    serviceId: ObjectId,
    service: String,
    details: String,
    duration: Number,
    sittings: Number,
    dnd: String,
    tags: String,
    category: String
}, {timestamp: true})

const Services = mongoose.model('services', servicesSchema)

module.exports = Services
