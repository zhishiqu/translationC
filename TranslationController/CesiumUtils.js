/**CesiumUtils底下的方法
 * 延长距离
 * @param cartesian{Cesium.Cartesian3}
 * @return{Cesium.Cartesian3}
 */
 export default class CesiumUtils{

     static extended(cartesian, length) {
     
         const result = new Cesium.Cartesian3();
         Cesium.Cartesian3.normalize(cartesian, result);
         Cesium.Cartesian3.add(cartesian, Cesium.Cartesian3.multiplyByScalar(result, length, result), result)
         return result
     }
 }