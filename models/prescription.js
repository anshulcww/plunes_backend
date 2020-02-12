const mongoose = require('mongoose')

const User = require('./user')

const prescriptionSchema = mongoose.Schema({
    userId: String,
    doctorId: String,
    patientId: String,
    patientName: String,
    prescriptionData: {},
    prescriptionUrl: String
})

prescriptionSchema.statics.getPrescriptionForUser = async (userId) => {
    const personalPrescriptions = await Prescription.find({
        patientId: userId
    }).sort({
        _id: -1
    })
    for (var p of personalPrescriptions) {
        if (!p.patientId) {
            continue
        }
        const u = await User.findById(p.patientId)
        if (u) {
            p.patientName = u.name
        }
    }

    const businessPrescriptions = await Prescription.find({
        userId: userId
    }).sort({
        _id: -1
    })
    for (var p of businessPrescriptions) {
        if (!p.patientId) {
            continue
        }
        const u = await User.findById(p.patientId)
        if (u) {
            p.patientName = u.name
        }
    }

    return {
        personalPrescriptions,
        businessPrescriptions
    }
}

const Prescription = mongoose.model('prescription', prescriptionSchema)

module.exports = Prescription