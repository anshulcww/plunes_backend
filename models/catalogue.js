const mongoose = require('mongoose')
const fs = require('fs')

const ObjectId = mongoose.Types.ObjectId

const catalogueSchema = mongoose.Schema({
    speciality: String,
    services: [{
        service: String,
        details: String,
        duration: Number,
        sittings: Number,
        dnd: String,
        tags: String,
        category: String
    }]
})


catalogueSchema.statics.addSpeciality = async (speciality) => {
    const catalogue = await Catalogue.findOne({
        speciality
    })
    if (!catalogue) {
        const catalogue = Catalogue({
            speciality: speciality
        })
        await catalogue.save()
    }

    return catalogue
}

catalogueSchema.statics.addService = async (service, speciality) => {
    const catalogue = await Catalogue.findOne({
        speciality
    })
    if (!catalogue) {
        return
    }

    catalogue.services = catalogue.services.concat(service)
    await catalogue.save()
}

catalogueSchema.statics.refreshCatalogue = async (jsonFile) => {
    const masterCatalogue = JSON.parse(fs.readFileSync(jsonFile))
    await masterCatalogue.forEach(async function (speciality) {
        const catalogue = Catalogue({
            speciality: speciality.speciality
        })
        await catalogue.save()
        speciality.catalogue.forEach(async function (service) {
            catalogue.services = catalogue.services.concat({
                service: service.PROCEDURES,
                details: service.DETAILS,
                dnd: service.DND,
                tags: service.TAG,
                category: service.TYPE
            })
        })
        await catalogue.save()
    })
}

catalogueSchema.statics.findSpeciality = async (speciality) => {
    const s = await Catalogue.findOne({
        speciality: speciality
    })
    return s
}

catalogueSchema.statics.findService = async (service) => {
    const s = await Catalogue.findOne({
        'services.service': service
    })
    return s
}

catalogueSchema.statics.findSpecialityId = async (specialityId) => {
    const s = await Catalogue.findOne({
        _id: ObjectId(serviceId)
    })
    return s
}

catalogueSchema.statics.findServiceId = async (serviceId) => {
    const s = await Catalogue.findOne({
        'services._id': ObjectId(serviceId)
    })
    return s
}

catalogueSchema.statics.findServiceDetails = async (service) => {
    const s = await Catalogue.findOne({
        'services.service': service
    })
    if (!s) {
        return []
    }
    const specialityId = s._id.toString()
    const index = s.services.findIndex(t => t.service == service)
    const serviceId = s.services[index]._id.toString()
    return [specialityId, serviceId]
}

catalogueSchema.statics.findServiceDetailsI = async (service) => {
    const s = await Catalogue.findOne({
        'services.service': new RegExp(service, 'i')
    })
    if (!s) {
        return []
    }
    const specialityId = s._id.toString()
    const index = s.services.findIndex(t => t.service == service)
    const serviceId = s.services[index]._id.toString()
    return [specialityId, serviceId]
}

catalogueSchema.statics.findSpecialityName = async (specialityId) => {
    const s = await Catalogue.findOne({
        _id: ObjectId(specialityId)
    })
    if (s) {
        return s.speciality
    } else {
        return undefined
    }
}

catalogueSchema.statics.findServiceName = (serviceId) => {
    return new Promise(async (resolve, reject) => {
        try {
            const serviceRecord = await Catalogue.aggregate([{
                $match: {
                    'services._id': ObjectId(serviceId)
                }
            },
            {
                $project: {
                    serviceName: {
                        $filter: {
                            input: '$services',
                            as: 'services',
                            cond: {
                                $eq: ['$$services._id', ObjectId(serviceId)]
                            }
                        }
                    },
                    _id: 0
                }
            }
            ])
            // console.log({serviceRecord})
            resolve(serviceRecord.length > 0 ? serviceRecord[0].serviceName[0].service : null)
        } catch (e) {
            reject(e)
        }
    })
}


catalogueSchema.statics.findServiceData = async (serviceId) => {
    const c = await Catalogue.find({})
    for (var s of c) {
        const index = s.services.findIndex((x) => x._id.toString() == serviceId)
        if (index != -1) {
            return s.services[index]
        }
    }
    return undefined
}

catalogueSchema.statics.allServices = async () => {
    const c = await Catalogue.find({})
    var result = []
    for (var sp of c) {
        for (var se of sp.services) {
            result = result.concat(se.service)
        }
    }
    return result
}

const Catalogue = mongoose.model('catalogue', catalogueSchema)

module.exports = Catalogue
