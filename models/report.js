const mongoose = require('mongoose')

const User = require('./user')

const ObjectId = mongoose.Types.ObjectId

const reportSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    userName: String,
    userSpecialities: [],
    userAddress: String,
    userExperience: Number,
    specialityId: {
        type: String
    },
    self: {
        type: Boolean,
        required: true
    },
    reportName: String,
    test: String,
    patientMobileNumber: String,
    accessList: [{
        userId: String,
        accessType: String
    }],
    problemAreaDiagnosis: String,
    reasonDiagnosis: String,
    consumptionDiet: String,
    avoidDiet: String,
    precautions: String,
    medicines: String,
    remarks: String,
    reportUrl: String,
    createdTime: Number
})

reportSchema.statics.deleteById = async (reportId) => {
    const result = await Report.deleteOne({
        _id: ObjectId(reportId)
    })
    return result
}

reportSchema.statics.findById = async (reportId) => {
    const report = await Report.findOne({
        _id: ObjectId(reportId)
    })
    return report
}

reportSchema.statics.findPersonalReports = async (userId, mobileNumber) => {
    const personalReports = await Report.find({
        $or: [{
                userId: userId,
                self: true
            },
            {
                patientMobileNumber: mobileNumber
            }
        ]
    }).sort({
        createdTime: -1
    })
    for (var i = 0; i < personalReports.length; i++) {
        const user = await User.findById(personalReports[i].userId)
        if (user) {
            personalReports[i].userName = user.name
            personalReports[i].userSpecialities = user.specialities.forEach(x => delete x.services)
            personalReports[i].userAddress = user.address
            personalReports[i].userExperience = user.experience
        }
    }
    return personalReports
}


reportSchema.statics.findBusinessReports = async (userId) => {
    var businessReports = []
    const reportsByMe = await Report.find({
        userId: userId,
        self: false
    }).sort({
        createdTime: -1
    })
    businessReports = businessReports.concat(reportsByMe)

    const reportsShared = await Report.find({
        'accessList.userId': userId
    })
    businessReports = businessReports.concat(reportsShared)

    let userData = {}
    for (var i = 0; i < businessReports.length; i++) {
        let user = undefined
        if (businessReports[i].userId in userData) {
            user = userData[businessReports[i].userId]
        } else {
            user = await User.findById(businessReports[i].userId)
            userData[businessReports[i].userId] = user
        }
        businessReports[i].userName = user.name
        businessReports[i].userSpecialities = user.specialities.forEach(x => delete x.services)
        businessReports[i].userAddress = user.address
        businessReports[i].userExperience = user.experience
    }
    return businessReports
}

const Report = mongoose.model('report', reportSchema)

module.exports = Report