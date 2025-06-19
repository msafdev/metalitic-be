show dbs
use <database>
show collections
db.<collections>.find()

db.nama_koleksi.updateOne({ _id: ObjectId("6521d6bcae1234567890abcd")}, { $set: { field_yang_diubah: "nilai_baru" }})

// inisial awal
pm2 start index.js --name myapp

// memberhentikan pm2
pm2 stop myapp
pm2 stop 0

// menghapus pm2
pm2 delete myapp
pm2 list

// menjalankan kembali
pm2 start myapp
pm2 start 0

Agar app tetap jalan setelah reboot:
pm2 startup
pm2 save
