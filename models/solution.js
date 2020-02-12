const mongoose = require('mongoose')

const User = require('./user')

const ObjectId = mongoose.Types.ObjectId

const solutionSchema = mongoose.Schema({
    serviceId: String,
    userId: String,
    name: String,
    imageUrl: String,
    services: [{
        professionalId: String,
        name: String,
        imageUrl: String,
        price: [Number],
        newPrice: [Number],
        recommendation: Number,
        discount: Number,
        latitude: Number,
        longitude: Number,
        distance: Number,
        category: [String],
        timeSlots: [],
        negotiating: Boolean,
        index: Number
    }],
    createdTime: Number,
    booked: {
        type: Boolean,
        default: false
    }
})

solutionSchema.statics.findSolutionService = async (solutionServiceId) => {
    const [solutionId, serviceId, index] = solutionServiceId.split('|')
    const solution = await Solution.findOne({
        _id: ObjectId(solutionId)
    })
    const services = solution.services.filter((service) => {
        return service._id.toString() == serviceId
    })
    const service = services[0]
    console.log({service})
    // service.price = service.price[index]
    // service.newPrice = service.newPrice[index]
    // service.category = service.category[index]
    if(service) {
        service.index = parseInt(index)
        return service
    }
}

solutionSchema.statics.findSolutionsByUserId = async (userId) => {
    const solutions = await Solution.find({
        userId: userId,
        booked: false
    }).sort({
        createdTime: -1
    })
    return solutions
}

solutionSchema.statics.findSolutionsByServiceId = async (serviceId) => {
    const solutions = await Solution.find({
        serviceId: serviceId,
        booked: false
    }).sort({
        createdTime: -1
    })
    return solutions
}

const Solution = mongoose.model('solution', solutionSchema)

module.exports = Solution