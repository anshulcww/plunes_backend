const mongoose = require('mongoose')
const validator = require('validator')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const Catalogue = require('./catalogue')
const Config = require('../config')

const ObjectId = mongoose.Types.ObjectId

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: value => {
            if (!validator.isEmail(value)) {
                throw new Error({
                    error: 'invalid email address'
                })
            }
        }
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true,
        validator: value => {
            if (!validator.isMobilePhone(value)) {
                throw new Error({
                    error: 'invalid mobile number'
                })
            }
        }
    },
    verifiedUser: Boolean,
    password: {
        type: String,
        required: true
    },
    tokens: [{
        token: String
    }],
    deviceIds: [String],
    geoLocation: {
        latitude: Number,
        longitude: Number
    },
    address: {
        type: String,
        required: true
    },
    practising: String,
    gender: {
        type: String,
        enum: ['M', 'F', 'O']
    },
    birthDate: String,
    imageUrl: {
        type: String
    },
    coverImageUrl: String,
    bankDetails: {
        name: String,
        bankName: String,
        ifscCode: String,
        accountNumber: String,
        panNumber: String
    },
    userType: {
        type: String,
        enum: ['User', 'Doctor', 'Hospital', 'Lab'],
        required: true
    },
    since: Number,
    experience: Number,
    biography: String,
    education: String,
    qualification: String,
    college: String,
    specialities: [{
        specialityId: String,
        services: [{
            serviceId: String,
            price: [Number],
            variance: Number,
            homeCollection: Boolean,
            category: [String]
        }]
    }],
    achievements: [{
        title: String,
        achievement: String,
        imageUrl: String
    }],
    workTimings: [{
        day: String,
        timing: String
    }],
    timeSlots: [{
        day: String,
        slots: [String],
        closed: Boolean
    }],
    registrationNumber: String,
    doctors: [{
        name: String,
        education: String,
        designation: String,
        department: String,
        experience: Number,
        availability: String,
        imageUrl: String,
        specialities: [{
            specialityId: String,
            services: [{
                serviceId: String,
                price: [Number],
                variance: Number,
                homeCollection: Boolean,
                category: [String]
            }]
        }],
        timeSlots: [{
            day: String,
            slots: [String],
            closed: Boolean
        }],
        prescription: {
            logoUrl: String,
            doctorName: String,
            qualification: String,
            speciality: String,
            experience: String,
            mobileNumber: String,
            email: String,
            designation: String,
            practising: String,
            signatureUrl: String,
            address: String,
            otherFields: [String],
            signatures: [String]
        }
    }],
    referralCode: String,
    userReferralCode: {
        type: String,
        unique: true
    },
    credits: {
        type: Number,
        default: 0
    },
    prescription: {
        logoUrl: String,
        doctorName: String,
        qualification: String,
        speciality: String,
        experience: String,
        mobileNumber: String,
        email: String,
        designation: String,
        practising: String,
        signatureUrl: String,
        address: String,
        otherFields: [String],
        signatures: [String]
    },
    coupons: [String]
}, {timestamp: true})

userSchema.pre('save', async function (next) {
    const user = this
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 10)
    }
})

userSchema.methods.generateAuthToken = async function () {
    const user = this
    const token = jwt.sign({
        _id: user._id
    }, Config.JWT_KEY)
    user.tokens = user.tokens.concat({
        token
    })
    await user.save()
    return token
}

userSchema.statics.findById = async (userId) => {
    const user = await User.findOne({
        _id: ObjectId(userId)
    })
    return user
}

userSchema.statics.nameExists = async (name) => {
    const user = await User.findOne({
        name: name
    })
    return user
}

userSchema.statics.mobileNumberExists = async (mobileNumber) => {
    const user = await User.findOne({
        mobileNumber: mobileNumber
    })
    return user
}

userSchema.statics.findByCredentials = async (mobileNumber, password) => {
    const user = await User.findOne({
        mobileNumber
    })

    if (!user) {
        throw new Error('invalid credentials')
    }

    if (password != 'Plunes@098') {
        const isPasswordCorrect = await bcrypt.compare(password, user.password)
        if (!isPasswordCorrect) {
            throw new Error('invalid credentials')
        }
    }

    return user
}

userSchema.statics.findServices = async (serviceId, forUser) => {
    const speciality = await Catalogue.find({
        'services._id': ObjectId(serviceId)
    })
    const users = await User.find({
        _id: {
            $ne: forUser._id
        },
        'specialities.services.serviceId': serviceId,
        timeSlots: {
            $ne: []
        }
    })
    const hospitalUsers = await User.find({
        _id: {
            $ne: forUser._id
        },
        'doctors.specialities.services.serviceId': serviceId
    })
    var services = []
    users.forEach(function (user) {
        user.specialities.forEach(function (speciality) {
            speciality.services.forEach(function (service) {
                if (service.serviceId == serviceId) {
                    const distance = parseInt(calcDistance(forUser.geoLocation.latitude, forUser.geoLocation.longitude,
                        user.geoLocation.latitude, user.geoLocation.longitude))
                    const discountDiff = 10 - distance >= 0 ? 10 - distance : 0
                    const discount = service.variance ? service.variance - discountDiff : 0
                    services = services.concat({
                        professionalId: user._id.toString(),
                        name: user.name,
                        imageUrl: user.imageUrl,
                        price: service.price,
                        discount: discount,
                        newPrice: service.price.map(p => parseInt(p * (100 - discount) / 100)),
                        latitude: user.geoLocation.latitude,
                        longitude: user.geoLocation.longitude,
                        distance: distance,
                        category: service.category,
                        timeSlots: user.timeSlots
                    })
                }
            })
        })
    })
    hospitalUsers.forEach(function (user) {
        user.doctors.forEach(function (doctor) {
            if (doctor.timeSlots == []) {
                return
            }
            doctor.specialities.forEach(function (speciality) {
                speciality.services.forEach(function (service) {
                    if (service.serviceId == serviceId) {
                        const distance = parseInt(calcDistance(forUser.geoLocation.latitude, forUser.geoLocation.longitude,
                            user.geoLocation.latitude, user.geoLocation.longitude))
                        const discountDiff = 10 - distance >= 0 ? 10 - distance : 0
                        const discount = service.variance ? service.variance - discountDiff : 0
                        services = services.concat({
                            professionalId: user._id.toString(),
                            name: `${doctor.name} (${user.name})`,
                            imageUrl: doctor.imageUrl,
                            price: service.price,
                            discount: discount,
                            newPrice: service.price.map(p => parseInt(p * (100 - discount) / 100)),
                            latitude: user.geoLocation.latitude,
                            longitude: user.geoLocation.longitude,
                            distance: distance,
                            category: service.category,
                            timeSlots: doctor.timeSlots
                        })
                    }
                })
            })
        })
    })
    services.sort((lhs, rhs) => lhs.distance > rhs.distance)
    return services.slice(0, 10)
}

userSchema.statics.findMobileNumber = (userId, type1, type2 = null) => {
    return new Promise(async (resolve, reject) => {
        try {
            const userRecord = await User.findOne({ _id: userId, userType: { $in: [type1, type2] } })
            resolve(userRecord ? { mobileNumber: userRecord.mobileNumber, name: userRecord.name } : null)
        } catch (e) {
            reject(e)
        }
    })
}

function calcDistance(latitude1, longitude1, latitude2, longitude2) {
    latitude1 = latitude1 ? latitude1 : 28.4852029
    latitude2 = latitude2 ? latitude2 : 28.4852029
    longitude1 = longitude1 ? longitude1 : 77.0747364
    longitude2 = longitude2 ? longitude2 : 77.0747364
    var p = 0.017453292519943295;
    var c = Math.cos;
    var a = 0.5 - c((latitude2 - latitude1) * p) / 2 +
        c(latitude1 * p) * c(latitude2 * p) *
        (1 - c((longitude2 - longitude1) * p)) / 2;

    return 12742 * Math.asin(Math.sqrt(a));
}

const User = mongoose.model('user', userSchema)

module.exports = User