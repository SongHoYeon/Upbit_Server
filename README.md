# Upbit Autotrading App - Server

## 1. 개요
업비트 RESTful API 를 이용한 가상화폐 자동거래 Protocol Server

## 2. 작업환경 셋팅
로컬PC에 [nodejs](http://nodejs.org/)가 설치되어 있어야 합니다.
본 저장소에 작업셋팅파일(package.json,gulpfile.js)이 모두 포함되어 있으므로 install 명령어로 node package만 설치하는 것으로 작업환경 설정을 할 수 있습니다.

```
$ npm install
```

```
Node version >= 12.17
```

## 3. Protocol List
- 회원가입
```
{"regist", { id : "string", pw : "string", nickname : "string", phone : "string", name : "string"}}
```
- 로그인
```
{"login", { id : "string", pw : "string" }}
```
- Upbit AccessKey & SecretKey 등록
```
{"updateUpbitKey", { id : "string", accessKey : "string", secretKey : "string" }}
```
- Scalping 세팅
```
{"setScalping", { id : "string", scalpingList : [ { marketId : "string", items : [ { buyPrice : "number" , sellPrice : "number", volumn : "number }, { ... } ] }, {..} ] }}
```
- 유저 포인트 조회
```
{"getPoint", { id : "string", point : "number"}}
```

## 4. MongoDB 실행 & 종료
```
brew services start mongodb-community
brew services stop mongodb
```
