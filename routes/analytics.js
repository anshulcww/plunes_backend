const express = require('express')
const Service = require('../models/services')
const User = require('../models/user');
const Booking = require('../models/booking')
const Solution = require('../models/solution');
const Covid = require('../models/covid');
const router = express.Router()
const auth = require('../middleware/auth')
const mongoose = require('mongoose')


router.get('/getCovidBooking', async (req, res) => {
    try{
        let covid = await Covid.find({}).sort({_id:-1})
        let result = []
        covid.forEach((c) =>{
            var date = new Date(c.createdAt);
            
            let obj  = {
                "name" : c.name,
                "createdAt" : date.toLocaleString("en-US", {timeZone: "Asia/Kolkata"}),
                "message" : c.message,
                "mobileNumber" : c.mobileNumber
            }
            result.push(obj)
        })
        // console.log(covid)
        res.status(201).send({
            success : true,
            data: result
        })
    }catch(error){
        res.status(400).send({
            success : false,
        })
    }
})


router.get('/getServices', auth, async (req, res) => {
    //console.log("Get user", req.params.id)
    const user = req.user;
    console.log(user._id)
     let result = await User.aggregate([
        {$match: { '_id': user._id}},
        {$unwind:"$specialities"},
        {$unwind:"$specialities.services"},
          {
                $addFields: {
                    "serviceId": { "$toObjectId": "$specialities.services.serviceId" }
                }
            },
        {$lookup: {
            from: Service.collection.name, 
            localField: 'serviceId', 
            foreignField: 'serviceId', 
            as: 'schoolInfo'}},
        {$unwind:"$schoolInfo"},
        {
             $project: {
                         "_id":1,
                    "service" : "$schoolInfo.service",
                    "serviceId" : "$schoolInfo.serviceId"
                }
        }
    ])
    res.status(201).send({
        status: 1,
        data: result,
        msg: ''
    })
  
})


router.get('/solutionUsers', auth, async(req, res) => {
    const solution = await Solution.aggregate([{
        
            $match : {
                "services" : { $elemMatch : {"professionalId"  : req.user._id.toString()}},

            }
        },
    {$sort: {_id: -1}}
    ])
    var map = new Map()
    let i = 1
    solution.forEach((s)=>{
        var date = new Date(s.createdTime);
        var month = date.getMonth();
        if(map.has(month)){
            let prevValue = map.get(month)
            //console.log(prevValue, prevValue++)
            map.set(month, prevValue+1);
        }else{
            map.set(month, 1)
        }
    })
    var result = [];
map.forEach(function(val, key) {
    result.push({ month: key, count: val });
});
console.log(result, 'res')
    //let x = Object.fromEntries(map);
    res.status(201).send({
        success: true,
        data: result
    })
})


router.get('/solutionSearch', auth, async(req, res) => {
    //console.log('Anshul')
    const user = req.user
    const solution = await Solution.aggregate([
        {
        
            $match : {
                "services" : { $elemMatch : {"professionalId"  : req.user._id.toString()}},

            }
        },
            {
                $addFields: {
                    "serviceId": { "$toObjectId": "$serviceId" }
                }
            },
        {
            $lookup: {
                "from": Service.collection.name,
                "localField": "serviceId",
                "foreignField": "serviceId",
                "as": "serviceDoc"
            }
        },
        {
            $unwind: "$serviceDoc"
        },
        {
            $addFields: {
                "serviceName": "$serviceDoc.service"
            }
        },
        {
            $project: {
                "serviceDoc" : 0
            }
        },
        {$sort: {_id: -1}},
        {$limit: 5}
    ])
    //console.log('Anshul 2')
    //console.log(solution, 'solution')
    let solInsights = []
    solution.forEach((s, index) => {
        //console.log(s.serviceName, 'service name')
        s.services.forEach((se) => {
            if(se.professionalId === user._id.toString()){
                //console.log(true, {se})
                let negotiating = se.negotiating;
                let timeRemaining = null;
                if(negotiating){
                    if((Date.now() - s.createdTime) < 1000000){
                        console.log(Date.now() - s.createdTime)
                        let objTime = Date.now() - s.createdTime
                        timeRemaining = 1000000 - objTime
                        //console.log(timeRemaining)
                        negotiating = true
                    }else{
                     negotiating = false
                    }
                }
                // if(index == 0){
                //     negotiating = true,
                //     timeRemaining = 10000
                // }
                
                let obj  = {
                    "solutionId" : s._id,
                    "serviceId" : se._id,
                    "userName" : s.name,
                    "profName" : se.name,
                    "serviceName" : s.serviceName,
                    "negotiating" : negotiating,
                    "createdTime": s.createdTime,
                    "timeRemaining" : timeRemaining,
                    "userPrice" : se.newPrice[0]
                }
                console.log(obj)
                solInsights.push(obj)
            }
        })
    })
    res.status(201).send({
        success: true,
        data: solInsights
    })
})

router.get('/solutionInsight',auth, async(req, res) => {
    const user = req.user
    const solution = await Solution.aggregate([
        {
            $addFields: {
                "serviceId": { "$toObjectId": "$serviceId" }
            }
        },
        {
            $lookup: {
                "from": Service.collection.name,
                "localField": "serviceId",
                "foreignField": "serviceId",
                "as": "serviceDoc"
            }
        },
        {
            $unwind: "$serviceDoc"
        },
        {
            $addFields: {
                "serviceName": "$serviceDoc.service"
            }
        },
        {
            $project: {
                "serviceDoc" : 0
            }
        },
        {$sort: {_id: -1}},
        { $limit : 20 }
    ])
    let insights = []
    let price = []
    let avgPrice = 0
    let totalPrice = 0;
    //console.log(solution, 'solution')
    solution.forEach((s) => {
        //console.log(s.serviceName, 'service name')
        if(user.specialities){
            user.specialities.forEach((sp) => {
                if(sp.services){
                    sp.services.forEach((se) => {
                        // console.log(s.serviceId , se.serviceId)
                        if(s.serviceId.toString() === se.serviceId){
                            //console.log('true')
                            s.services.forEach((s) => {
                                if(s.professionalId !== user._id.toString()){
                                    price.push(s.price[0])
                                }
                            })
                            for(var i =0; i<price.length; i++) {
                                totalPrice = totalPrice + price[i]
                            }
                            if(price.length > 0 ){
                               avgPrice = totalPrice / price.length
                            }
                            let uPrice = se.price[0] - (se.price[0])*se.variance/100 ;
                            let percent = (uPrice - avgPrice)/uPrice * 100
                            //console.log(percent, 'percent' );
                            if(uPrice > avgPrice){
                                //console.log('asnhul')
                                //let percent = (uPrice - avgPrice)/uPrice * 100
                                //console.log(s.serviceName, 'service name')
                                let obj = {
                                    'serviceName' : s.serviceName,
                                    'percent' : Math.floor(percent),
                                    'avgPrice' : Math.floor(avgPrice),
                                    'userPriceVariance' : uPrice,
                                    'specialityId' : sp.specialityId,
                                    'serviceId' : se.serviceId,
                                    'userPrice' : se.price[0]
                                }
                                //console.log(obj, 'obj');
                                insights.push(obj);
                            }
                        }
                    })
                }
            })
        }
    })
    //console.log(insights)
    res.status(201).send({
        success: true,
        data: insights
    })
})



router.get('/insight', auth, async (req, res) => {
    const user = req.user
    const bookings = await Booking.aggregate([
        {
            $match: {
                professionalId: { $ne: user._id.toString() }
            }
        },
        {
            $addFields: {
                "serviceId": { "$toObjectId": "$serviceId" }
            }
        },
        {
            $lookup: {
                "from": Service.collection.name,
                "localField": "serviceId",
                "foreignField": "serviceId",
                "as": "serviceDoc"
            }
        },
        {
            $unwind: "$serviceDoc"
        },
        {
            $addFields: {
                "serviceName": "$serviceDoc.service"
            }
        }
    ]);
    let insights = [];
    bookings.forEach((b) => {
        if(user.specialities){
            user.specialities.forEach((sp) => {
                if(sp.services){
                    sp.services.forEach((se) => {
                        if(b.serviceId.toString() === se.serviceId){
                            let bPrice = b.service.price[0];
                            let uPrice = se.price[0] - (se.price[0])*se.variance/100 ;
                            if(uPrice > bPrice){
                                let percent = (uPrice - bPrice)/uPrice * 100
                                let obj = {
                                    'serviceName' : b.serviceName,
                                    'percent' : Math.floor(percent),
                                    'bookingPrice' : bPrice,
                                    'userPriceVariance' : uPrice,
                                    'specialityId' : sp.specialityId,
                                    'serviceId' : se.serviceId,
                                    'userPrice' : se.price[0]
                                }
                                insights.push(obj);
                            }
                        }
                    })
                }
            })
        }
    })
    res.status(201).send({
        success: true,
        data: insights
    })
})
router.get('/users', async (req, res) => {
    const users = await User.find({}).sort({
        _id: -1
    })
    var data = []
    users.forEach((u) => {
        u.tokens = undefined
        u.password = undefined
        data = data.concat({
            user: u,
            timestamp: u._id.getTimestamp()
        })
    })
    res.status(201).send({
        success: true,
        data: data
    })
})

module.exports = router