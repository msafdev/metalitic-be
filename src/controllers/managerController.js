const sanitize = require('mongo-sanitize');
const User = require("../models/User");
const Project = require("../models/Project");
const Session = require("../models/Session");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const path = require('path');

const bcrypt = require('bcrypt');

async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

async function verifyPassword(inputPassword, storedHashedPassword) {
    return await bcrypt.compare(inputPassword, storedHashedPassword);
}

const registerUser = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        //! blm ada filter dari body nya
        const {
            username,
            password,
            name,
            nomorInduk,
            devisi,
            jabatan,
            email,
            noHp,
            alamat
        } = req.body;

        // console.log("existingUser ", existingUser)
        //! jika tidak ditemukan user atau blm di verify dan harus admin
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek akun
        const existingUsername = await User.findOne({ username });
        const existingNomorInduk = await User.findOne({ nomorInduk });
        const existingEmail = await User.findOne({ email: { $regex: `^${email}$`, $options: 'i' } });
        const existingNoHp = await User.findOne({ noHp });

        if (existingUsername) return res.status(200).json({ status: false, message: "Username sudah digunakan" });
        if (existingNomorInduk) return res.status(200).json({ status: false, message: "Nomor Induk sudah digunakan" });
        if (existingEmail) return res.status(200).json({ status: false, message: "Email sudah digunakan" });
        if (existingNoHp) return res.status(200).json({ status: false, message: "Nomor HP sudah digunakan" });

        //! hash password
        const hashedPassword = await hashPassword(password);

        //! Simpan user ke database
        const newUser = new User(
            {
                username: username,
                password: hashedPassword,
                name: name,
                nomorInduk: nomorInduk,
                devisi: devisi,
                jabatan: jabatan,
                email: email,
                noHp: noHp,
                alamat: alamat,
                projects: [],
                filename: "-",
                filepath: "-",
                isSuperAdmin: false,
                isAdmin: false,
                isVerify: true,
            }
        );
        await newUser.save();

        res.status(200).json({ status: true, message: "Registrasi user berhasil" });
    } catch (error) {
        res.status(500).json({ message: "register failed" });
    }
}

const loginUser = async (req, res) => {
    try {
        const username = sanitize(req.body.username);
        const inputPassword = req.body.password;

        //! jika username sudah exist
        const existingUser = await User.findOne({ username: username });

        //! jika tidak exist
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
            return res.status(400).json({ message: "login failed" });
        }

        //! cek apakah sudah di verify dan manager
        if (existingUser.isVerify && existingUser.isAdmin) {
            const isVerifyPassword = await verifyPassword(inputPassword, existingUser.password)

            console.log("result ", isVerifyPassword)
            if (!isVerifyPassword) {
                return res.status(400).json({ message: "login failed" });
            }

            // Buat JWT Token
            const token = jwt.sign({ username: username, }, process.env.JWT_SECRET_MANAGER, { expiresIn: '1h' });

            // Simpan JWT dalam HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true, // Mencegah akses JavaScript (XSS)
                secure: true,   // Hanya aktif jika pakai HTTPS
                sameSite: 'Strict', // Mencegah CSRF
                maxAge: 3600000  // Cookie berlaku 1 jam
            });

            res.cookie('role', `supervisor`, {
                httpOnly: false, // Bisa diakses oleh JavaScript
                secure: true,   // Hanya aktif jika pakai HTTPS
                sameSite: 'Strict', // Mencegah CSRF
                maxAge: 3600000  // Cookie berlaku 1 jam
            });

            //! hapus session lama base on userId
            const resultDelete = await Session.deleteMany({ userId: existingUser._id });
            //! Simpan token pada db session
            const newLogin = new Session(
                {
                    userId: existingUser._id,
                    token: token
                }
            );
            await newLogin.save();

            return res.status(200).json({ message: 'Login Manager Admin berhasil' });
            //! generate token user biasa
        } else if (existingUser.isVerify && !existingUser.isAdmin) {
            const isVerifyPassword = await verifyPassword(inputPassword, existingUser.password)

            console.log("result ", isVerifyPassword)
            if (!isVerifyPassword) {
                return res.status(400).json({ message: "login failed" });
            }

            // Buat JWT Token
            const token = jwt.sign({ username: username, }, process.env.JWT_SECRET, { expiresIn: '1h' });

            // Simpan JWT dalam HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true, // Mencegah akses JavaScript (XSS)
                secure: true,   // Hanya aktif jika pakai HTTPS
                sameSite: 'Strict', // Mencegah CSRF
                maxAge: 3600000  // Cookie berlaku 1 jam
            });

            res.cookie('role', `user`, {
                httpOnly: false, // Bisa diakses oleh JavaScript
                secure: true,   // Hanya aktif jika pakai HTTPS
                sameSite: 'Strict', // Mencegah CSRF
                maxAge: 3600000  // Cookie berlaku 1 jam
            });

            //! hapus session lama base on userId
            const resultDelete = await Session.deleteMany({ userId: existingUser._id });
            //! Simpan token pada db session
            const newLogin = new Session(
                {
                    userId: existingUser._id,
                    token: token
                }
            );
            await newLogin.save();

            return res.status(200).json({ message: 'Login User berhasil' });
        }

        res.status(400).json({ message: "login failed" });

    } catch (error) {
        res.status(500).json({ message: "login failed" });
    }
}

const logoutUser = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;

        const result = await Session.deleteOne({ userId: existingUser._id });

        res.status(200).json({ message: "Logout berhasil" });
    } catch (error) {
        res.status(500).json({ message: "Logout failed" });
    }
}

const getUsers = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;

        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized1' });
        }

        const result = await User.find({ isSuperAdmin: false }).select("name nomorInduk devisi jabatan email noHp alamat filename _id");

        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: "Get User failed" });
    }
}

const editUser = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const { id, name, devisi, jabatan, email, noHp, alamat, password } = req.body;

        let filepath = "-";
        let filename = "-";

        if (req.file) {
            console.log("Ada file terupload")
            filepath = req.file.path;
            filename = req.file.filename;
        }


        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized1' });
        }

        //! jika id adalah super admin request ditolak
        const userFound = await User.findById(id);

        if (userFound.isSuperAdmin) {
            return res.status(401).json({ message: 'Unauthorized2' });
        }

        console.log("email ", email)
        //! cek apakah nohp dan email sudah terdaftar
        const existingUserRegisteredWithEmail = await User.findOne({
            email: { $regex: `^${email}$`, $options: 'i' }
        });

        const existingUserRegisteredWithNoHp = await User.findOne({
            noHp: noHp
        });

        console.log(existingUserRegisteredWithEmail)
        console.log(userFound?.username)

        //! hash password
        const hashedPassword = await hashPassword(password);
        //! jika data email dan noHp sudah terdaftar DAN username tidak sama
        if (
            existingUserRegisteredWithEmail &&
            existingUserRegisteredWithEmail?.username !== userFound?.username
        ) {
            return res.status(200).json({ status: false, message: 'Edit failed, email sudah terdaftar' });
        }

        if (
            existingUserRegisteredWithNoHp &&
            existingUserRegisteredWithNoHp?.username !== userFound?.username
        ) {
            return res.status(200).json({ status: false, message: 'Edit failed, no HP sudah terdaftar' });
        }

        // Buat data yang akan diupdate
        const updateData = {
            name,
            devisi,
            jabatan,
            email,
            noHp,
            alamat,
            ...(password !== "********" && { password: hashedPassword }),
            ...(req.file && { filename, filepath }),
        };

        // Update data
        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });

        if (req.file && updatedUser) {
            const filePathDelete = path.resolve(userFound.filepath);
            fs.unlink(filePathDelete, (err) => {
                if (err) {
                    console.error('Gagal menghapus file:');
                } else {
                    console.log('File berhasil dihapus');
                }
            });
        }


        res.status(200).json({ status: true, message: "Edit Berhasil" });

    } catch (error) {
        res.status(500).json({ message: "Edit failed" });
    }
}

const deleteUser = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const { id } = req.body;

        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized2' });
        }

        //! cek akun
        const userFound = await User.findById(id);
        if (userFound.isSuperAdmin || userFound.isAdmin) {
            return res.status(400).json({ message: "Delete user failed" });
        }

        const result = await User.findByIdAndDelete(id);

        if (!result) {
            return res.status(400).json({ message: "Delete user failed" });
        }

        const filePathDelete = path.resolve(userFound.filepath);
        fs.unlink(filePathDelete, (err) => {
            if (err) {
                console.error('Gagal menghapus file:');
            } else {
                console.log('File berhasil dihapus');
            }
        });

        res.status(200).json({ message: "success" });

    } catch (error) {
        res.status(500).json({ message: "Delete User failed" });
    }
}

const getImageProfile = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const { id, filename } = req.body;

        //! jika tidak ditemukan user atau blm di verify dlihat gambar
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const userFound = await User.findOne({ _id: id, filename: filename });
        if (!userFound) {
            return res.status(400).json({ message: 'Unauthorized22' });
        }

        const filePath = path.resolve(userFound.filepath);
        if (!fs.existsSync(filePath)) {
            const filePathDefault = path.resolve(__dirname, '../', 'default', 'default.jpg');
            console.log(filePathDefault)
            // return res.sendFile(filePathDefault);
            return res.status(400).json({ message: 'File Not found' });
        }
        return res.sendFile(filePath);

    } catch (error) {
        res.status(500).json({ message: "Get Image Profile failed" });
    }
}

const checkAuth = async (req, res) => {
    const existingUser = req.existingUser;

    if (existingUser.isAdmin === false && existingUser.isSuperAdmin === false) {
        return res.status(200).json({ role: "user", message: "Valid token" });
    } else {
        return res.status(200).json({ role: "supervisor", message: "Valid token" });
    }
}

const getAllProject = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;

        //! jika tidak ditemukan user atau blm di verify dan harus admin 
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const result = await Project.find().select("namaProject permintaanJasa sample tglPengujian lokasiPengujian areaPengujian posisiPengujian material GritSandWhell ETSA kamera mikrosopMerk mikrosopZoom _id");

        res.status(200).json({ message: result });
    } catch (error) {
        res.status(500).json({ message: "Get Project failed" });
    }
}

const addProject = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const {
            namaProject,
            permintaanJasa,
            sample,
            tglPengujian,
            lokasiPengujian,
            areaPengujian,
            posisiPengujian,
            material,
            GritSandWhell,
            ETSA,
            kamera,
            mikrosopMerk,
            mikrosopZoom } = req.body;

        //! jika tidak ditemukan user atau blm di verify dan harus admin 
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek nama project sudah ada atau tidak
        const existingNamaProject = await Project.findOne({ namaProject: namaProject });
        if (existingNamaProject) {
            return res.status(200).json({ status: false, message: "nama projek sudah terdaftar" });
        }

        const [day, month, year] = tglPengujian.split("/");
        const paddedDay = day.padStart(2, '0');
        const paddedMonth = month.padStart(2, '0');
        const convertedDate = new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00Z`);

        //! Simpan user ke database
        const newUser = new Project(
            {
                namaProject,
                permintaanJasa,
                sample,
                tglPengujian: convertedDate,
                lokasiPengujian,
                areaPengujian,
                posisiPengujian,
                material,
                GritSandWhell,
                ETSA,
                kamera,
                mikrosopMerk,
                mikrosopZoom,
                userArrayId: []
            }
        );
        await newUser.save();

        res.status(200).json({ status: true, message: "add project sucess" });
    } catch (error) {
        res.status(500).json({ message: "Add Project failed" });
    }
}

const editProject = async (req, res) => {
    try {

        console.log("edit admin")
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const {
            id,
            namaProject,
            permintaanJasa,
            sample,
            tglPengujian,
            lokasiPengujian,
            areaPengujian,
            posisiPengujian,
            material,
            GritSandWhell,
            ETSA,
            kamera,
            mikrosopMerk,
            mikrosopZoom } = req.body;

        console.log(req.body)

        //! jika tidak ditemukan user atau blm di verify dan harus admin 
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! get data project lama 
        const oldDataProject = await Project.findById(id);

        //! jika data projek lama tidak ada dan bukan punya user maka tolak
        if (oldDataProject.length === 0) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek nama project sudah ada atau tidak
        const existingNamaProject = await Project.findOne({ namaProject: namaProject });
        if (existingNamaProject && existingNamaProject?.namaProject !== oldDataProject?.namaProject) {
            return res.status(200).json({ status: false, message: "Gagal Proses Edit data, nama projek sudah terdaftar" });
        }

        const [day, month, year] = tglPengujian.split("/");
        const paddedDay = day.padStart(2, '0');
        const paddedMonth = month.padStart(2, '0');
        const convertedDate = new Date(`${year}-${paddedMonth}-${paddedDay}T00:00:00Z`);

        // Buat data yang akan diupdate
        const updateData = {
            namaProject,
            permintaanJasa,
            sample,
            tglPengujian: convertedDate,
            lokasiPengujian,
            areaPengujian,
            posisiPengujian,
            material,
            GritSandWhell,
            ETSA,
            kamera,
            mikrosopMerk,
            mikrosopZoom
        };

        // Update data
        const updatedProject = await Project.findByIdAndUpdate(id, updateData, { new: true });

        console.log("updatedProject ", updatedProject)

        res.status(200).json({ status: true, message: "Edit Berhasil" });
    } catch (error) {
        res.status(500).json({ message: "Edit Project failed" });
    }
}

const deleteProject = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        const { id } = req.body;

        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        const result = await Project.findByIdAndDelete(id);

        if (!result) {
            return res.status(400).json({ message: "Delete user failed" });
        }

        res.status(200).json({ message: "success" });
    } catch (error) {
        res.status(500).json({ message: "Delete Project failed" });
    }
}

const addUserProject = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        let { id, userId } = req.body;

        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        if (!Array.isArray(userId)) {
            userId = []
        }

        //! cek apakah semua user terdaftar
        const foundDocs = await User.find({ _id: { $in: userId } });

        //! jika semua user terdaftar masukan pada UserArrayId
        if (foundDocs && foundDocs.length === userId.length) {
            // Buat data yang akan diupdate
            const updateData = {
                userArrayId: userId
            };
            // Update data
            const updatedProject = await Project.findByIdAndUpdate(id, updateData, { new: true });

            return res.status(200).json({ message: "Data user berhasil ditambahkan" });
        }

        return res.status(400).json({ message: "Data User tidak valid" });
    } catch (error) {
        res.status(500).json({ message: "Add Data user failed" });
    }
}

const getUserProject = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;
        let { id } = req.body;

        //! jika tidak ditemukan user atau blm di verify dan hanya admin yang boleh edit
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin || !existingUser.isAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek apakah semua user terdaftar
        const foundProject = await Project.findById(id).select("userArrayId -_id");

        if (foundProject) {
            return res.status(200).json({ message: foundProject.userArrayId });
        }

        return res.status(400).json({ message: 'Data tidak ditemukan' });
    } catch (error) {
        res.status(500).json({ message: "Get Data user failed" });
    }
}

const getProfile = async (req, res) => {
    try {
        //! data dati authoMidddleware
        const existingUser = req.existingUser;

        //! jika tidak ditemukan user atau blm di verify 
        if (!existingUser || !existingUser.isVerify || existingUser.isSuperAdmin) {
            return res.status(401).json({ message: 'Unauthorized' });
        }

        //! cek apakah semua user terdaftar
        const foundUser = await User.findById(existingUser._id).select("name nomorInduk devisi jabatan -_id");

        if (foundUser) {
            return res.status(200).json({ message: foundUser });
        }

        return res.status(400).json({ message: 'Data tidak ditemukan' });
    } catch (error) {
        res.status(500).json({ message: "Get Data user failed" });
    }
}


module.exports = {
    getImageProfile,
    registerUser,
    loginUser,
    logoutUser,
    getUsers,
    editUser,
    deleteUser,
    checkAuth,
    getAllProject,
    addProject,
    editProject,
    deleteProject,
    addUserProject,
    getUserProject,
    getProfile,
}