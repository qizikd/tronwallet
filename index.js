const TronWeb = require('tronweb');
const HttpProvider = TronWeb.providers.HttpProvider;
var express = require('express');
var bodyParser = require('body-parser');
var url = require('url');
var router = express.Router();
var app = express();

const log4js = require('log4js');
log4js.configure({
  appenders: { 
	normal: { 
		type: 'file', 
		filename: "/root/tronwallet/logs/file.log",
		maxLogSize: 1024*1024*1,
		backups: 100		
	} },
  categories: { 
	default: { 
		appenders: ['normal'], 
		level: 'info' 
	} }
});

const logger = log4js.getLogger('normal');

const fullNode = new HttpProvider('https://api.trongrid.io');
const solidityNode = new HttpProvider('https://api.trongrid.io');
const eventServer = 'https://api.trongrid.io/';

const tronWeb = new TronWeb(
 fullNode,
 solidityNode,
 eventServer
);

async function trade(to,amount,from,privateKey){
    // Performs the trade between Token and TRX
    const tx = await tronWeb.transactionBuilder.sendTrx(to, amount, from);
	if (tx == undefined){
		throw new Error(`创建交易失败`)
	}

    // Signing the transaction
    const signedtxn = await tronWeb.trx.sign(tx, privateKey);
	if (signedtxn == undefined){
		throw new Error(`交易签名失败`)
	}
	
    // Broadcasting the transaction
    const receipt = await tronWeb.trx.sendRawTransaction(signedtxn);    
	if (receipt == undefined){
		throw new Error(`交易发送失败`)
	}	
	return receipt
};

/*
const trxtx = trade("TEAKde1Mrc69ZMsx6RaaCZbPZLSvLBMp7Y",50000,"TVfXe5CV2aAzv1mXEzbeUuZVS4TvqLWwPs","421402703262b7ff699530efb5185e93c8ac412fc77bb9de22491524561aafcf");
trxtx.then( result =>{
	console.log(result);
}).catch((err) => {
	console.log("err==>",err);
});
*/

//获取url请求客户端ip
var get_client_ip = function(req) {
    var ip = req.headers['x-forwarded-for'] ||
        req.ip ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress || '';
    if(ip.split(',').length>0){
        ip = ip.split(',')[0]
    }
    return ip;
};

app.get('/wallet/trx/newaddress', function (req, res, next){
	console.log((new Date()).toLocaleString(),"客户端ip",get_client_ip(req),"生成地址Url",req.url);		
	try{
		var addr = tronWeb.utils.accounts.generateAccount();
		var json = {};
		json.code = 0;
		json.data = addr;
		res.end(JSON.stringify(json));
		console.log((new Date()).toLocaleString(),"新地址:",json);
		return;
	}catch(err){
		logger.error('生成地址异常:', err.message);
		console.log((new Date()).toLocaleString(),"生成地址异常",err.message);     //网络请求失败返回的数据  		
		var json = {};
		json.msg = "生成地址异常";
		json.code = -1;
		res.end(JSON.stringify(json));
	}			
})

app.get('/wallet/trx/balance', function (req, res, next){
	logger.info("客户端ip",get_client_ip(req),"查询余额Url",req.url);
	console.log("客户端ip",get_client_ip(req),"查询余额Url",req.url);		
	var arg = url.parse(req.url, true).query; 
	var address = arg.address;
	logger.info("查询余额,地址:",address);
	console.log((new Date()).toLocaleString(),"查询余额,地址:",address)
	try{
		var balanceResult = tronWeb.trx.getBalance(address);
		balanceResult.then(balance =>{
			logger.debug(balance);
			var json = {};
			json.code = 0;
			json.data = {};
			json.data.amount = parseInt(balance);
			res.end(JSON.stringify(json));
			console.log((new Date()).toLocaleString(),"余额:",json);
			return;
		}).catch((err) => {
			logger.error('获取余额失败:', err.message);
			console.log((new Date()).toLocaleString(),"获取余额失败",err.message);     //网络请求失败返回的数据  
			var json = {};
			json.code = -1;
			json.msg = "获取余额失败";
			res.end(JSON.stringify(json));
		});
	}catch(err){
		logger.error('请求获取余额异常:', err.message);
		console.log((new Date()).toLocaleString(),"请求获取余额异常",err.message);     //网络请求失败返回的数据  		
		var json = {};
		json.msg = "获取余额异常";
		json.code = -1;
		res.end(JSON.stringify(json));
	}			
})

var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();  
app.post('/wallet/trx/sendto',multipartMiddleware, function (req, res, next) {		
	logger.info("客户端ip",get_client_ip(req),"转账Url",req.url)
	console.log("客户端ip",get_client_ip(req),"转账Url",req.url)	
	try
	{
		var privkey = req.body.privkey
		var fromaddress = req.body.fromaddress
		var toaddress = req.body.toaddress			
		var amount = parseInt(req.body.amount)
		if (amount <= 0){
			throw new Error(`amount:${amount} <= 0 `)
		}
	}catch(err){
		logger.error('金额非法:', err.message)
		console.log((new Date()).toLocaleString(), "金额非法",err.message); 
		var json = {};
		json.msg = "金额非法"
		json.errcode = -3
		json.code = -3
		json.errorinfo = "金额非法:" + err.message
		res.end(JSON.stringify(json))	
		return		
	}
	
	logger.info("转账从",fromaddress,"到",toaddress,amount);
	console.log((new Date()).toLocaleString(),"转账从",fromaddress,"到",toaddress,amount);
	const trxtx = trade(toaddress,amount,fromaddress,privkey);
	trxtx.then( tx =>{
		console.log(tx);
		if(tx.result == true){
			var json = {};
			json.code = 0;
			json.data = {};
			json.data.txid = tx.transaction.txID;
			res.end(JSON.stringify(json));
			logger.info((new Date()).toLocaleString(),"交易成功:",tx);
			console.log((new Date()).toLocaleString(),"交易成功:",json)	;
		}	
	}).catch((err) => {
		logger.error((new Date()).toLocaleString(),'发送tx请求失败:', err)
		console.log((new Date()).toLocaleString(), "发送tx请求失败",err);     //网络请求失败返回的数据  
		var json = {};				
		json.code = -1
		json.msg = "交易失败"
		json.errorinfo = "发送tx请求失败:" + err
		res.end(JSON.stringify(json))
		return		
	});
});

module.exports = router;

var port = 87;
var args = process.argv.splice(2)
if(args.length == 1){
	port = parseInt(args[0]);
}

var server = app.listen(port, function () {   //监听端口
  var host = server.address().address
  var port = server.address().port
  console.log('Example app listening at http://%s:%s', host, port);
})


