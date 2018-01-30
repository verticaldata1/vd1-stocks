
var express = require('express');
var path = require("path");
var bodyParser = require("body-parser");
var fetch = require("node-fetch");
var WebSocketServer = require('websocket').server;
var flash = require("connect-flash");
var app = express();

app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs");

app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(flash());
app.use(function(req, res, next) {
  res.locals.seriesArr = globalSeriesArrString;
  res.locals.symbolList = symbolList;
  res.locals.errors = req.flash("error");
  next();
});

var globalSeriesArr = [];
var globalSeriesArrString = null;
var symbolList = [];
var wsConnections = {};
var connectionCounter = 0;


app.get("/", function (req, res) {
  res.render("index");
});


app.post("/add", function(req, res, next) {
  var symbol = req.body.symbol;
  
  var fetchTerm = "https://www.quandl.com/api/v3/datasets/WIKI/"+symbol+".json?limit=365&collapse=daily&api_key="+process.env.QUANDL_API_KEY;
  var fetchJson = fetch(fetchTerm).then(function(res) {
    console.log("got fetch result");
    return res.json();
  }).then(function(json) {
    var datePriceArr = [];
    var chartData = [];
    for(var ii = json.dataset.data.length-1; ii >= 0; ii--) {
      var date = Date.parse(json.dataset.data[ii][0]);  // natural to unix timestamp
      datePriceArr = [date, json.dataset.data[ii][4]];
      chartData.push(datePriceArr);
      datePriceArr = [];
    }
    
    symbolList.push(json.dataset.dataset_code);
    var newSeries = {name: json.dataset.dataset_code, data: chartData};
    globalSeriesArr.push(newSeries);
    globalSeriesArrString = JSON.stringify(globalSeriesArr);
    
    //res.locals.seriesArr = globalSeriesArrString;
    for(var key in wsConnections) {
      wsConnections[key].sendUTF(JSON.stringify({ cmd:'reload'}) );
    }
  }).catch(function () {
    console.log("Promise Rejected");
    
  });
  
});

app.get("/delete/:symbol", function (req, res) {
  var symbol = req.params.symbol;
  
  var idx = symbolList.indexOf(symbol);
  if(idx !== -1) {
    symbolList.splice(idx, 1);
    globalSeriesArr.splice(idx, 1);
    if(globalSeriesArr.length == 0) {
      globalSeriesArrString = null;
    }
    else {
      globalSeriesArrString = JSON.stringify(globalSeriesArr);
    }
    //console.log("After deletion:"+globalSeriesArrString);
    for(var key in wsConnections) {
      wsConnections[key].sendUTF(JSON.stringify({ cmd:'reload'}) );
    }
    console.log("redirecting");
    res.redirect("/");
  }
  else {
    console.log("Unable to delete "+symbol); 
    res.redirect("/");
  }
});


// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});

var wsServer = new WebSocketServer({
  httpServer: listener
});

wsServer.on('request', function(request) {  
  var connection = request.accept(null, request.origin); 
  
  connection.id = connectionCounter++;
  wsConnections[connection.id] = connection;
  console.log('New connection. id='  + connection.id);
  
  connection.on('close', function(reasonCode, description) {
    console.log("Peer " + connection.id + " disconnected.");
      delete wsConnections[connection.id];
  });
  
  connection.on('message', function(message) {
    if (message.type === 'utf8') {
      console.log("connection received message");
    }
  });
  
});
