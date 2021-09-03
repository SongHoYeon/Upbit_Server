const ERROR_TYPE = {
    // Login
    id_incorrect : 100,
    pw_incorrect : 101,
    id_duplicate : 102,

    // GetPoint
    user_notfound : 103,
    
};
const COMPLETE_TYPE = {
    // Regist
    regist_complete : 0,
    // Login
    login_complete : 1,
    // Update Upbit Key
    updateUpbitKey_complete : 2,
    // GetPoint
    getPoint_complete : 3,
    // SetPoint
    setPoint_complete : 4,
    // GetAllPoint
    getAllPoint_complete : 5,
};

exports.error_type = ERROR_TYPE;
exports.complete_type = COMPLETE_TYPE;