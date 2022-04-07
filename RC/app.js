// Defining variables
const express = require("express");
const session = require("express-session");
const fileupload = require("express-fileupload");
const port = 3112;
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);



const fs = require("fs");
const md5 = require("md5");

var loggedinusers = {}




// Function for generateing random number for colors
function randomColor() {
    return Math.floor(Math.random() * (100 - 0 + 1) + 0)
}


// Function for generateing key
function password_to_key(password) {
    password = md5(md5(md5(password)))
    let key = []
    for (i = 0; i < password.length; i++) {
        key[i] = password[i].charCodeAt(0)
    }
    return key
}


// Function for encrypting
function encrypt(password, data) {
    let n = 0
    key = password_to_key(password)
    encrypted = []
    for (i = 0; i < data.length; i++) {
        encrypted[i] = (data[i].charCodeAt(0) + key[n])
        n += 1
        if (n >= key.length) {
            n = 0
        }
    }
    let encrypted_data = ""
    for (i = 0; i < encrypted.length; i++) {
        encrypted_data += encrypted[i].toString() + "|"
    }
    return encrypted_data
}


// Function for decrypting
function decrypt(password, data) {
    let n = 0
    let key = password_to_key(password)
    let decrypted = []
    let decrypted_data = ""
    let letter = ""
    for (i = 0; i < data.length; i++) {
        if (data[i].charCodeAt(0) >= 48 && data[i].charCodeAt(0) <= 57) {
            letter += data[i]
        }
        else if (data[i].charCodeAt(0) == 124) {
            decrypted[i] = (parseInt(parseInt(letter) - key[n]))
            n += 1
            letter = ""
            if (n >= key.length) {
                n = 0
            }
        }
    }
    for (i = 0; i < decrypted.length; i++) {
        decrypted_data += String.fromCharCode(decrypted[i])
    }
    return decrypted_data
}

// Function for getting chat file name
function cfn(password, username) {
    let filename = "chats/" + md5(encrypt(password, username)) + ".json"
    return filename
}

// Function for creating json file for chat
function newChatJsonFile(password, username, chatname, bgcolor, creationdate, message_date, profile_photo) {
    let d = `"-"`;
    if (creationdate) {
        let date = new Date();
        d = `["${date.getMinutes()}","${date.getHours()}","${date.getDate()}","${date.getMonth()}","${date.getFullYear()}"]`
    }
    let jsonData = `
    {
        "information" : {
            "name" : "${encrypt(password, chatname)}",
            "creating-date" : ${d},
            "bgcolor" : "${bgcolor}",
            "message_date" : "${message_date}",
            "profile_photo" : "${profile_photo}",
            "connection" : "${md5(encrypt(username,password))}"
        },
    
        "messages" : [
            
        ]
    }
    `;
    let jsonObj = JSON.parse(jsonData);
    let jsonContent = JSON.stringify(jsonObj);

    fs.writeFile(`chats/${md5(encrypt(password, username))}.json`, jsonContent, "utf8", function (err) { });
}

// Function for saveing message
function saveMessage(username, password, message, type, color, savedate, fileinputname) {
    console.log("-------",message,);
    let date = new Date();
    let filedata = fs.readFileSync(cfn(password, username))
    let jsonObj = JSON.parse(filedata);
    let d = "";
    if (savedate) {
        d = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth(), date.getFullYear()]
    }
    let message_to_save = {
        "message": `${encrypt(password, message)}`,
        "type": `${type}`,
        "color": `${color}`,
        "date": d,
        "fileinputname": fileinputname
    }
    jsonObj["messages"].push(message_to_save)
    let jsonContent = JSON.stringify(jsonObj);
    fs.writeFileSync(`chats/${md5(encrypt(password, username))}.json`, jsonContent, "utf8");
    message_to_save["message"] = decrypt(password,message_to_save["message"])
    message_to_save["type"] = "fs"
    return JSON.stringify(message_to_save);
}

// Defining routes
app.set("view engine", "ejs");
app.use(express.urlencoded());
const path = require('path');
const { log } = require("util");
app.use(express.static('public'))
app.use(fileupload());

app.use(session({
    secret: "dbec174f7b9410798058da89188f2f4c",
    resave: false,
    saveUninitialized: true
}));

app.get("/", (req, res) => (req.session.loggedin) ? res.redirect("/home") : res.redirect("/login"));




app.get("/home", (req, res) => {
    if (req.session.loggedin) {

        let filedata = fs.readFileSync(cfn(req.session.password, req.session.username))
        let data = JSON.parse(filedata);
        for (let k = 0; k < data["messages"].length; k++) {
            data["messages"][k]["message"] = String(decrypt(req.session.password, data["messages"][k]["message"]))
            if (data["messages"][k]["type"] == "image") {
                data["messages"][k]["image-path"] = "/files/" + md5(encrypt(req.session.password, data["messages"][k]["fileinputname"])) + "." + data["messages"][k]["fileinputname"].substr(data["messages"][k]["fileinputname"].indexOf(".") + 1, 10)
            }
        }
        data["information"]["name"] = decrypt(req.session.password, data["information"]["name"])
        let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        data["month"] = months[data["information"]["creating-date"][3]]
        res.render("home", { uorp: data })
        // if (loggedinusers[req.session.username] === "0"){
        //     loggedinusers[req.session.username] = "1";
        //     io.on("connection", (socket) => {
                
        //         socket.on(data["information"]["connection"], (msg) => {
        //         socket.broadcast.emit(data["information"]["connection"], "nm");
        //     });
        //     });
        // }
        
        

    
    }
    else {
        res.redirect("/login")
    }
});
app.post("/home", (req, res) => {
    if (req.session.loggedin) {
        let type = "text";
        var file_input_name = "";
        if (req.body.message.indexOf("youtube.com/") != -1) {
            type = "youtube-video"
        }
        console.log(req.files);
        if (req.files != null) {
            console.log("mta");
            type = "file"
            if (req.files.fileinput['mimetype'].substr(0, req.files.fileinput['mimetype'].indexOf("/")) == "image") {
                type = "image"
            }
        }
        if (type == "file" || type == "image") {
            file_input_name = req.files.fileinput["name"];
            req.files.fileinput.mv("public/files/" + md5(encrypt(req.session.password, req.files.fileinput["name"])) + "." + req.files.fileinput['name'].substr(req.files.fileinput['name'].indexOf(".") + 1, 10))
        }
        saveMessage(req.session.username, req.session.password, req.body.message, type, req.session.colorid, req.session.savemessagetime, file_input_name, file_input_name)
        let filedata = fs.readFileSync(cfn(req.session.password, req.session.username))
        let data = JSON.parse(filedata);
        for (let k = 0; k < data["messages"].length; k++) {
            data["messages"][k]["message"] = String(decrypt(req.session.password, data["messages"][k]["message"]))
            if (data["messages"][k]["type"] == "image") {
                data["messages"][k]["image-path"] = "/files/" + md5(encrypt(req.session.password, data["messages"][k]["fileinputname"])) + "." + data["messages"][k]["fileinputname"].substr(data["messages"][k]["fileinputname"].indexOf(".") + 1, 10)
            }
        }
        data["information"]["name"] = decrypt(req.session.password, data["information"]["name"])
        let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        data["month"] = months[data["information"]["creating-date"][3]]
        res.render("home", { uorp: data })
    }
    else {
        res.redirect("/login")
    }

})

// Function for logining
app.get("/login", (req, res) => { return req.session.loggedin ? res.redirect("/home") : res.render("login", { uorp: null }) });
app.post("/login", (req, res) => {

    if (req.session.loggedin) {
        return res.redirect("/home")
    }
    if (fs.existsSync(cfn(req.body.password, req.body.username))) {
        req.session.loggedin = true;
        req.session.username = req.body.username;
        req.session.password = req.body.password;
        let savemessagetime = JSON.parse(fs.readFileSync(cfn(req.session.password, req.session.username)))['information']['message_date'];
        req.session.savemessagetime = savemessagetime;
        req.session.colorid = `rgb(${randomColor()},${randomColor()},${randomColor()})`
        if (!loggedinusers[req.session.username]){
            loggedinusers[req.session.username] = "0";
        }
        return res.redirect("/home");
    }
    
    return res.render("login", { uorp: false });
})

// Function for makeing new chat
app.get("/newchat", (req, res) => res.render("newchat", { uorp: null }));
app.post("/newchat", (req, res) => {
    let users = fs.readFileSync("users.json");
    users = JSON.parse(users);
    users = users["usernames"]
    if (req.body.password.length < 8) {
        return res.render("newchat", { uorp: 110 })
    }
    for (let i = 0; i < users.length; i++) {
        if (users[i] === req.body.username) {
            return res.render("newchat", { uorp: 111 });
        }
    }
    let filedata = fs.readFileSync("users.json")
    let jsonObj = JSON.parse(filedata);
    jsonObj["usernames"].push(req.body.username)
    let jsonContent = JSON.stringify(jsonObj);
    fs.writeFile("users.json", jsonContent, "utf8", function (err) { });
    req.session.loggedin = true;
    req.session.username = req.body.username;
    req.session.password = req.body.password;
    req.body.savemessagetime == "on" ? req.session.savemessagetime = true : req.session.savemessagetime = false;
    req.session.colorid = `rgb(${randomColor()},${randomColor()},${randomColor()})`;
    let photo_file;
    if (req.files == null) {
        photo_file = `/chaticons/default.png`
    }
    else {
        photo_file = `/chaticons/${md5(cfn(req.session.password, req.session.username))}.${req.files.chatphoto['mimetype'].substr(req.files.chatphoto['mimetype'].indexOf("/") + 1, 10)}`
        req.files.chatphoto.mv("public" + photo_file)
    }
    newChatJsonFile(req.body.password, req.body.username, req.body.chatname, req.body.bgcolor, req.body.creationdate, req.body.savemessagetime == "on" ? req.session.savemessagetime = true : req.session.savemessagetime = false, photo_file)
    if (!loggedinusers[req.session.username]){
        loggedinusers[req.session.username] = "0";
    }
    return res.redirect("/home");



})




// Function for logout
app.get("/logout", (req, res) => {
    delete loggedinusers[req.session.username]
    req.session.username = "";
    req.session.password = "";
    req.session.loggedin = false;
    res.redirect("/login")
});

// Function for clearing
app.get("/clear", (req, res) => {


    return res.render("clear", { uorp: true });
});

app.post("/clear", (req, res) => {
    if (req.session.loggedin) {
        if (req.body.password == req.session.password) {
            let filedata = fs.readFileSync(cfn(req.session.password, req.session.username))
            let jsonObj = JSON.parse(filedata);
            jsonObj["messages"] = []
            let jsonContent = JSON.stringify(jsonObj);
            fs.writeFile(`chats/${md5(encrypt(req.session.password, req.session.username))}.json`, jsonContent, "utf8", function (err) { });



            res.redirect("home")
        }
        else {
            return res.render("clear", { uorp: false });
        }
    }
    else {
        res.redirect("/home")
    }
})




// Function for deleteing
app.get("/delete", (req, res) => {
    return res.render("delete", { uorp: true });
});
app.post("/delete", (req, res) => {
    if (req.session.loggedin) {
        if (req.body.password == req.session.password) {
            fs.unlinkSync(cfn(req.session.password, req.session.username))

            let filedata = fs.readFileSync("users.json")
            let jsonObj = JSON.parse(filedata);

            let index = jsonObj["usernames"].indexOf(req.session.username);
            if (index !== -1) {
                jsonObj["usernames"].splice(index, 1);
            }
            let jsonContent = JSON.stringify(jsonObj);
            fs.writeFileSync("users.json", jsonContent, "utf8",);


            req.session.username = "";
            req.session.password = "";
            req.session.loggedin = false;
            res.redirect("/login")
        }
        else {
            return res.render("delete", { uorp: false });
        }
    }
    else {
        res.redirect("/login")
    }


})


// Function for downloading files
app.get('/download/:filename', function (req, res) {
    res.download("public/files/" + md5(encrypt(req.session.password, req.params.filename)) + "." + req.params.filename.substr(req.params.filename.indexOf(".") + 1, 10), req.params.filename)
});

// Function for auto joining
app.get('/joinchat/:username/:password', function (req, res) {
    if (fs.existsSync(cfn(req.params.password, req.params.username))) {
        req.session.loggedin = true;
        req.session.username = req.params.username;
        req.session.password = req.params.password;
        let savemessagetime = JSON.parse(fs.readFileSync(cfn(req.session.password, req.session.username)))['information']['message_date'];
        req.session.savemessagetime = savemessagetime;
        req.session.colorid = `rgb(${randomColor()},${randomColor()},${randomColor()})`
        res.redirect("/home")
    }
    else {
        return res.render("chatnotfound", { uorp: true })
    }
});




// Running the server
server.listen(port, () => console.log("Running Server"));