const sanitize = require('mongo-sanitize');
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt');

const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require("../models/User");
const UPT = require("../models/UPT");
const ULTG = require("../models/ULTG");
const NodeSetting = require("../models/Node_Seting");
const Node = require("../models/Node");
const Realtime = require("../models/Realtime");
const Unit = require("../models/Unit");

async function verifyPassword(inputPassword, storedHashedPassword) {
    return await bcrypt.compare(inputPassword, storedHashedPassword);
}

const loginUser = async (req, res) => {
    try {
        const username = sanitize(req.body.username);
        const inputPassword = req.body.password;

        //! jika username sudah exist
        const existingUser = await User.findOne({ username: username });
        //! cek apakah sudah di verify
        if (!existingUser || !existingUser.isVerify || existingUser.role === "admin" || existingUser.role === "local") {
            return res.status(400).json({ message: "login failed" });
        }

        const isVerifyPassword = await verifyPassword(inputPassword, existingUser.password)
        // console.log("result ", isVerifyPassword)
        if (!isVerifyPassword) {
            return res.status(400).json({ message: "login failed" });
        }

        // Buat JWT Token
        const token = jwt.sign({ username: username, role: existingUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });

        // Simpan JWT dalam HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,            // Tidak bisa diakses via JS
            secure: false,             // Harus false untuk HTTP (localhost)
            sameSite: "Lax",           // Bisa dikirim untuk request GET/refresh
            maxAge: 60 * 60 * 1000,    // 1 jam
            path: "/",                 // Cookie tersedia di semua path
        });

        res.cookie('role', existingUser.role, {
            httpOnly: false,            // Tidak bisa diakses via JS
            secure: false,             // Harus false untuk HTTP (localhost)
            sameSite: "Lax",           // Bisa dikirim untuk request GET/refresh
            maxAge: 60 * 60 * 1000,    // 1 jam
            path: "/",                 // Cookie tersedia di semua path
        });

        res.status(200).json({ message: 'Login berhasil 22' });

    } catch (error) {
        res.status(500).json({ message: "login failed" });
    }
}

async function getUnitRoleUPT(id) {
    return await UPT.aggregate([
        {
            $match: { _id: id }
        },
        {
            $lookup: {
                from: "ultgs",
                localField: '_id',
                foreignField: 'UPTId',
                as: 'ULTGS'
            }
        },
        {
            $unwind: {
                path: '$ULTGS',
                preserveNullAndEmptyArrays: true
            }
        },
        {
            $lookup: {
                from: "units",
                localField: 'ULTGS._id',
                foreignField: 'ULTGId',
                as: 'ULTGS.unit'
            }
        },
        {
            $group: {
                _id: '$_id',
                UPT: { $first: '$UPT' },
                ULTGS: {
                    $push: {
                        ULTG: '$ULTGS.ULTG',
                        unit: '$ULTGS.unit.unit' // akan jadi array of string
                    }
                }
            }
        },
        {
            $project: {
                _id: 0, // hide _id
                UPT: 1,
                ULTGS: {
                    ULTG: 1,
                    unit: 1
                }
            }
        }
    ]);
}

async function getUnitRoleULTG(uptId, ultgId) {
    const result = await UPT.aggregate([
        {
            $match: { _id: uptId }
        },
        {
            $lookup: {
                from: 'ultgs', // Nama collection B (lowercase dan plural biasanya)
                localField: '_id',
                foreignField: 'UPTId',
                as: 'ULTGS'
            }
        },
        {
            $unwind: '$ULTGS'
        },
        {
            $match: { 'ULTGS._id': ultgId }
        },
        {
            $lookup: {
                from: 'units', // Nama collection C (lowercase dan plural)
                localField: 'ULTGS._id',
                foreignField: 'ULTGId',
                as: 'ULTGS.unit'
            }
        },
        {
            $group: {
                _id: '$_id',
                UPT: { $first: '$UPT' },
                ULTGS: {
                    $push: {
                        ULTG: '$ULTGS.ULTG',
                        unit: '$ULTGS.unit.unit'
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                UPT: 1,
                ULTGS: {
                    $map: {
                        input: '$ULTGS',
                        as: 'item',
                        in: {
                            ULTG: '$$item.ULTG',
                            unit: '$$item.unit'
                        }
                    }
                }
            }
        }
    ]);
    return result[0] || null; // Hanya ambil object pertama
}

async function getUnitRoleUnit(uptId, ultgId, unitId) {
    const result = await UPT.aggregate([
        {
            $match: {
                _id: uptId
            }
        },
        {
            $lookup: {
                from: 'ultgs',
                localField: '_id',
                foreignField: 'UPTId',
                as: 'ULTGS'
            }
        },
        { $unwind: "$ULTGS" },
        {
            $match: {
                "ULTGS._id": ultgId
            }
        },
        {
            $lookup: {
                from: 'units',
                localField: 'ULTGS._id',
                foreignField: 'ULTGId',
                as: 'ULTGS.unitList'
            }
        },
        {
            $addFields: {
                "ULTGS.unit": {
                    $map: {
                        input: {
                            $filter: {
                                input: "$ULTGS.unitList",
                                as: "unitItem",
                                cond: {
                                    $eq: ["$$unitItem._id", unitId]
                                }
                            }
                        },
                        as: "filteredUnit",
                        in: "$$filteredUnit.unit"
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                UPT: 1,
                ULTG: "$ULTGS.ULTG",
                unit: {
                    $reduce: {
                        input: {
                            $cond: [
                                { $isArray: "$ULTGS.unit" },
                                "$ULTGS.unit",
                                [] // fallback kosong jika bukan array
                            ]
                        },
                        initialValue: [],
                        in: {
                            $concatArrays: [
                                "$$value",
                                {
                                    $cond: [
                                        { $isArray: "$$this" },
                                        "$$this",
                                        ["$$this"] // bungkus jadi array kalau ternyata string
                                    ]
                                }
                            ]
                        }
                    }
                }
            }
        },
        {
            $group: {
                _id: "$UPT",
                UPT: { $first: "$UPT" },
                ULTGS: {
                    $push: {
                        ULTG: "$ULTG",
                        unit: "$unit"
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                UPT: 1,
                ULTGS: 1
            }
        }
    ]);

    return result[0] || null; // Hanya ambil object pertama
}

const getUnitbyUser = async (req, res) => {
    try {
        const usernameToken = req.username;
        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });

        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek UPT
        const existingUPT = await UPT.findOne({ UPT: existingUser.UPT });
        if (!existingUPT) {
            return res.status(404).json({ message: "Unauthorized" });
        }
        //! jika role UPT
        if (existingUser.role === "UPT") {
            const result = await getUnitRoleUPT(existingUPT._id)
            return res.status(200).json({ message: result });
            //! jika role ULTG
        } else if (existingUser.role === "ULTG") {
            //! cek ULTG
            const existingULTG = await ULTG.findOne({ UPTId: existingUPT._id, ULTG: existingUser.ULTG });
            if (!existingULTG) {
                return res.status(404).json({ message: "Unauthorized" });
            }
            const result = await getUnitRoleULTG(existingUPT._id, existingULTG._id)
            const resultArray = [result]
            return res.status(200).json({ message: resultArray });
            //! jika role unit
        } else if (existingUser.role === "unit") {
            //! cek ULTG
            const existingULTG = await ULTG.findOne({ UPTId: existingUPT._id, ULTG: existingUser.ULTG });
            if (!existingULTG) {
                return res.status(404).json({ message: "Unauthorized" });
            }
            //! cek unit
            const existingUnit = await Unit.findOne({ ULTGId: existingULTG._id, unit: existingUser.unit });
            if (!existingUnit) {
                return res.status(404).json({ message: "Unauthorized" });
            }
            const result = await getUnitRoleUnit(existingUPT._id, existingULTG._id, existingUnit._id)
            return res.status(200).json({ message: result });
        }

        res.status(401).json({ message: 'Unauthorized' });
    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}

async function getNodesFromRealtimeDB(objectlistNode) {
    return await NodeSetting.aggregate([
        {
            $match: {
                _id: {
                    $in: objectlistNode
                }
            }
        },
        {
            $lookup: {
                from: 'realtimes', // nama koleksi S (huruf kecil jika default)
                localField: '_id',
                foreignField: 'nodeId',
                as: 'sData'
            }
        },
        {
            $unwind: {
                path: '$sData',
                preserveNullAndEmptyArrays: false // <== true ini penting agar tetap tampil walau tidak ada di S
            }
        },
        {
            $project: {
                _id: 0,
                nodeName: 1,
                UPT: 1,
                ULTG: 1,
                unit: 1,
                brand: 1,
                type: 1,
                gps_lat: 1,
                gps_long: 1,
                zonaInstallation: 1,
                isolasi: 1,
                // filename: 1,
                statusGauge: '$sData.statusGauge',
                statusCam: '$sData.statusCam',
                pressure: '$sData.pressure',
                dateTime: '$sData.dateTime'
            }
        }
    ]);
}

async function getNodesFromNodesDB(objectlistNode, matchSensorData) {
    return await NodeSetting.aggregate([
        {
            $match: {
                _id: {
                    $in: objectlistNode
                }
            }
        },
        {
            $lookup: {
                from: 'nodes', // nama koleksi S (huruf kecil jika default)
                localField: '_id',
                foreignField: 'nodeId',
                as: 'sensorData'
            }
        },
        {
            $unwind: {
                path: "$sensorData",
                preserveNullAndEmptyArrays: false // <== ini penting agar tetap tampil walau tidak ada di S
            }
        },
        {
            $match: matchSensorData
        },
        {
            $project: {
                _id: 0,
                nodeName: 1,
                // UPT: 0,
                // ULTG: 0,
                unit: 1,
                brand: 1,
                // type: 0,
                // gps_lat: 0,
                // gps_long: 0,
                zonaInstallation: 1,
                isolasi: 1,
                // filename: 1,
                // statusGauge: '$sData.statusGauge',
                statusCam: '$sData.statusCam',
                pressure: '$sData.pressure',
                dateTime: '$sData.dateTime'
            }
        }
    ]);
}

const getNodesbyUser = async (req, res) => {
    try {
        const usernameToken = req.username;
        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });
        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! jika role UPT
        if (existingUser.role === "UPT") {
            const listNode = await NodeSetting.find({ UPT: existingUser.UPT }).select("_id");
            //! jika listNode belum ada
            if (!listNode) {
                return res.status(200).json({ message: "data not found" });
            }
            // Ubah menjadi array ObjectId
            const objectlistNode = listNode.map(item => item._id);
            const result = await getNodesFromRealtimeDB(objectlistNode)

            return res.status(200).json({ message: result });
            //! jika role ULTG
        } else if (existingUser.role === "ULTG") {
            const listNode = await NodeSetting.find({ ULTG: existingUser.ULTG }).select("_id");
            //! jika listNode belum ada
            if (!listNode) {
                return res.status(200).json({ message: "data not found" });
            }
            // Ubah menjadi array ObjectId
            const objectlistNode = listNode.map(item => item._id);
            const result = await getNodesFromRealtimeDB(objectlistNode)

            return res.status(200).json({ message: result });
            //! jika role unit
        } else if (existingUser.role === "unit") {
            const listNode = await NodeSetting.find({ unit: existingUser.unit }).select("_id");
            //! jika listNode belum ada
            if (!listNode) {
                return res.status(200).json({ message: "data not found" });
            }
            // Ubah menjadi array ObjectId
            const objectlistNode = listNode.map(item => item._id);
            const result = await getNodesFromRealtimeDB(objectlistNode)

            return res.status(200).json({ message: result });
        }

        res.status(401).json({ message: 'Unauthorized' });

    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}

const getNodePicturebyNode = async (req, res) => {
    try {
        const usernameToken = req.username;
        const nodeName = req.body.node;
        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });
        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! jika role UPT
        if (existingUser.role === "UPT") {
            const existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT });
            if (!existingNodeSetting) {
                const filePath = path.resolve("/home/rezero/govision_backend/uploads/image_not_available.png");
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ message: "File not exists on server" });
                }
                return res.sendFile(filePath);
            }

            const filePath = path.resolve(existingNodeSetting.filepath);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: "File not exists on server" });
            }
            return res.sendFile(filePath);

            //! jika role ULTG
        } else if (existingUser.role === "ULTG") {
            const existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT, ULTG: existingUser.ULTG });
            if (!existingNodeSetting) {
                const filePath = path.resolve("/home/rezero/govision_backend/uploads/image_not_available.png");
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ message: "File not exists on server" });
                }
                return res.sendFile(filePath);
            }

            const filePath = path.resolve(existingNodeSetting.filepath);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: "File not exists on server" });
            }
            return res.sendFile(filePath);

            //! jika role ULTG
        } else if (existingUser.role === "unit") {
            const existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT, ULTG: existingUser.ULTG, unit: existingUser.unit });
            if (!existingNodeSetting) {
                const filePath = path.resolve("/home/rezero/govision_backend/uploads/image_not_available.png");
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ message: "File not exists on server" });
                }
                return res.sendFile(filePath);
            }

            const filePath = path.resolve(existingNodeSetting.filepath);
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ message: "File not exists on server" });
            }
            return res.sendFile(filePath);
        }

        res.status(401).json({ message: 'Unauthorized' });

    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}

const getNodeChartbyTime = async (req, res) => {
    try {
        const usernameToken = req.username;
        const nodeName = req.body.node;
        const timeType = req.body.type;
        const startParam = req.body.start;
        const endParam = req.body.end;

        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });
        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! hanya daily, weekly, monthly, other yang diijinkan 
        const typeValidation = ["daily", "weekly", "monthly", "other"];
        if (!typeValidation.includes(timeType)) {
            return res.status(400).json({ message: 'type is failed' });
        }

        let existingNodeSetting;

        console.log("role ", existingUser.role)

        //! jika role UPT
        if (existingUser.role === "UPT") {
            existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT });

            //! jika role ULTG
        } else if (existingUser.role === "ULTG") {
            existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT, ULTG: existingUser.ULTG });

            //! jika role ULTG
        } else if (existingUser.role === "unit") {
            existingNodeSetting = await NodeSetting.findOne({ nodeName: nodeName, UPT: existingUser.UPT, ULTG: existingUser.ULTG, unit: existingUser.unit });
        }
        //! jika nodesetting tidak ditemukan
        if (!existingNodeSetting) {
            return res.status(400).json({ message: 'data not found' });
        }
        //! daily
        let startOfDay;
        let endOfDay;
        if (timeType === typeValidation[0]) {
            startOfDay = moment().tz('Asia/Jakarta').startOf('day').toDate();
            endOfDay = moment().tz('Asia/Jakarta').endOf('day').toDate();
            //! weekly
        } else if (timeType === typeValidation[1]) {
            // Batas akhir: 23:59:59 hari ini (Asia/Jakarta)
            endOfDay = moment.tz('Asia/Jakarta').endOf('day').toDate();
            // Batas awal: 00:00:00 tujuh hari yang lalu (Asia/Jakarta)
            startOfDay = moment.tz('Asia/Jakarta').startOf('day').subtract(6, 'days').toDate();
        } else if (timeType === typeValidation[2]) {
            // Tanggal sekarang di zona waktu Asia/Jakarta
            endOfDay = moment().tz('Asia/Jakarta').endOf('day').toDate();
            // Tanggal 30 hari yang lalu dari sekarang
            startOfDay = moment().tz('Asia/Jakarta').subtract(30, 'days').startOf('day').toDate();
        } else if (timeType === typeValidation[3]) {
            //! cek format startParam dan endParam
            const isValidStart = moment(startParam, 'YYYY-MM-DD', true).isValid();
            if (!isValidStart) {
                return res.status(400).json({ message: 'format start is wrong' });
            }
            const isValidEnd = moment(endParam, 'YYYY-MM-DD', true).isValid();
            if (!isValidEnd) {
                return res.status(400).json({ message: 'format end is wrong' });
            }
            // Input user dalam WIB
            const inputStart = `${startParam} 00:00:00`;
            const inputEnd = `${endParam} 23:59:59`;

            // Konversi ke waktu UTC
            endOfDay = moment.tz(inputEnd, "YYYY-MM-DD HH:mm:ss", "Asia/Jakarta").toDate();
            startOfDay = moment.tz(inputStart, "YYYY-MM-DD HH:mm:ss", "Asia/Jakarta").toDate();
        }

        const result = await Node.aggregate([
            {
                $match: {
                    nodeId: existingNodeSetting._id,
                    createdAt: { $gte: startOfDay, $lte: endOfDay }
                }
            },
            {
                $sort: { createdAt: 1 }
            },
            {
                $group: {
                    _id: "$nodeId",
                    pressures: { $push: "$pressure" },
                    dateTime: { $push: "$dateTime" }
                }
            },
            {
                $project: {
                    _id: 0,
                    nodeId: { $toString: "$_id" },
                    pressures: 1,
                    dateTime: 1
                }
            }
        ]);
        return res.status(200).json({ message: result });

    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}

const checkAuth = async (req, res) => {
    res.status(200).json({ message: "Valid token" });
}

const userProfile = async (req, res) => {

    try {
        const usernameToken = req.username;

        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });
        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        let wilayahKerja;
        if (existingUser.role === "UPT") {
            wilayahKerja = existingUser.UPT
        } else if (existingUser.role === "ULTG") {
            wilayahKerja = existingUser.ULTG
        } else {
            wilayahKerja = existingUser.unit
        }

        const result = {
            username: existingUser.username,
            name: existingUser.name,
            // noHp : existingUser.noHp,
            wilayahKerja: wilayahKerja
        }

        res.status(200).json({ message: result });

    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}
const getNodebyDateTime = async (req, res) => {
    try {
        const usernameToken = req.username;
        const { startDateTime, endDateTime, node, statusCam } = req.body;

        console.log("node ", node)
        console.log("statusCam ", statusCam)
        console.log("startDateTime ", startDateTime)
        console.log("endDateTime ", endDateTime)

        //! cek akun
        const existingUser = await User.findOne({ username: usernameToken });
        //! jika tidak ditemukan user atau blm di verify
        if (!existingUser || !existingUser.isVerify) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        //! cek role
        //! hanya UPT, ULTG, unit yang diijinkan 
        const roleValidation = ["UPT", "ULTG", "unit"];
        if (!roleValidation.includes(existingUser.role)) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek format startParam dan endParam
        const isValidStart = moment(startDateTime, 'DD-MM-YYYY HH:mm', true).isValid();
        if (!isValidStart) {
            return res.status(400).json({ message: 'format startDateTime is wrong' });
        }
        const isValidEnd = moment(endDateTime, 'DD-MM-YYYY HH:mm', true).isValid();
        if (!isValidEnd) {
            return res.status(400).json({ message: 'format endDateTime is wrong' });
        }

        // ✅ Validasi nodeNameTarget HARUS array
        if (!Array.isArray(node)) {
            return res.status(400).json({ message: "format node tidak sesuai" });
        }

        // Input user dalam WIB
        const inputStart = `${startDateTime}:00`;
        const inputEnd = `${endDateTime}:59`;

        // Konversi ke waktu UTC
        endOfDay = moment.tz(inputEnd, "DD-MM-YYYY HH:mm:ss", "Asia/Jakarta").toDate();
        startOfDay = moment.tz(inputStart, "DD-MM-YYYY HH:mm:ss", "Asia/Jakarta").toDate();

        console.log(`Time Convert UTC ${startOfDay} ${endOfDay}`)

        // Tentukan kondisi filter CollectionA berdasarkan flag
        let collectionNodeSettingMatch = {
            nodeName: { $in: node },
            UPT: existingUser.UPT
        };

        if (existingUser.role === "ULTG") {
            collectionNodeSettingMatch.ULTG = existingUser.ULTG;
        } else if (existingUser.role === "unit") {
            collectionNodeSettingMatch.ULTG = existingUser.ULTG;
            collectionNodeSettingMatch.unit = existingUser.unit;
        }

        // if (node !== "Semua Node") {
        //     collectionNodeSettingMatch.nodeName = node;
        // }

        let matchSensorData = {
            "sensorData.createdAt": {
                $gte: startOfDay,
                $lte: endOfDay
            }
        };

        console.log("statusCam ", statusCam)

        if (statusCam !== "Semua Kamera") {
            matchSensorData["sensorData.statusCam"] = statusCam;
        }


        const result = await NodeSetting.aggregate([
            {
                $match: collectionNodeSettingMatch

            },
            {
                $lookup: {
                    from: "nodes", // pastikan lowercase dan plural jika pakai MongoDB default
                    localField: "_id",
                    foreignField: "nodeId",
                    as: "sensorData"
                }
            },
            {
                $unwind: "$sensorData"
            },
            {
                $match: matchSensorData
            },
            {
                $project: {
                    _id: 0,
                    nodeName: 1,
                    UPT: 1,
                    ULTG: 1,
                    unit: 1,
                    brand: 1,
                    zonaInstallation: 1,
                    isolasi: 1,
                    statusGauge: "$sensorData.statusGauge",
                    statusCam: "$sensorData.statusCam",
                    pressure: "$sensorData.pressure",
                    dateTime: "$sensorData.dateTime"
                }
            }
        ]);



        res.status(200).json({ message: result });

    } catch (error) {
        res.status(500).json({ message: 'Unauthorized' });
    }
}

const logout = async (req, res) => {
    // Hapus cookie bernama 'token'
    res.clearCookie('token', {
        httpOnly: true,
        secure: false,  // set true jika HTTPS
        sameSite: 'Lax',
        path: '/',
    });

    return res.status(200).json({ message: 'Logout' });
}

// const getNodeStatusCam = async (req, res) => {
//     try {
//         const usernameToken = req.username;
//         const ULTGparam = req.body.ULTG;
//         const unitParam = req.body.unit;
//         const statusCam = req.body.statusCam;


//         //! cek akun
//         const existingUser = await User.findOne({ username: usernameToken });
//         //! jika tidak ditemukan user atau blm di verify
//         if (!existingUser || !existingUser.isVerify) {
//             return res.status(401).json({ message: 'Unauthorized' });
//         }
//         //! cek role
//         //! hanya UPT, ULTG, unit yang diijinkan 
//         const roleValidation = ["UPT", "ULTG", "unit"];
//         if (!roleValidation.includes(existingUser.role)) {
//             return res.status(401).json({ message: 'Unauthorized' });
//         }

//         //! jika role = UPT
//         if (existingUser.role === "UPT") {
//             let listNode = []
//             //! cek parameter ULTG dan unit
//             if (ULTGparam === "Semua ULTG" && unitParam === "Semua Gardu Induk") {
//                 //! get nodesetting
//                 listNode = await NodeSetting.find({ UPT: existingUser.UPT }).select("_id");
//             } else if (ULTGparam !== "Semua ULTG" && unitParam === "Semua Gardu Induk") {
//                 //! get nodesetting
//                 listNode = await NodeSetting.find({ UPT: existingUser.UPT, ULTG: ULTGparam }).select("_id");
//             } else if (ULTGparam !== "Semua ULTG" && unitParam !== "Semua Gardu Induk") {
//                 //! get nodesetting
//                 listNode = await NodeSetting.find({ UPT: existingUser.UPT, ULTG: ULTGparam, unit: unitParam }).select("_id");
//             }

//             //! jika listNode belum ada
//             if (!listNode) {
//                 return res.status(200).json({ message: "data not found" });
//             }
//             // Ubah menjadi array ObjectId
//             const objectlistNode = listNode.map(item => item._id);
//             let matchSensorData = {}
//             if (statusCam !== "Semua Kamera") {
//                 matchSensorData["sensorData.statusCam"] = statusCam;
//             }
//             console.log("objectlistNode ", objectlistNode)
//             console.log("statusCam ", statusCam)
//             const result = await getNodesFromNodesDB(objectlistNode, matchSensorData)

//             return res.status(200).json({ message: result });

//         } else if (existingUser.role === "ULTG") {

//         } else if (existingUser.role === "unit") {

//         }



//         res.status(200).json({ message: result });

//     } catch (error) {
//         res.status(500).json({ message: 'Unauthorized' });
//     }
// }

const test = async (req, res) => {
    res.status(200).json({ message: "success123111" });
}

module.exports = { logout, getNodebyDateTime, userProfile, loginUser, getUnitbyUser, getNodesbyUser, getNodePicturebyNode, getNodeChartbyTime, checkAuth };