const Cesium = require("cesium/Source/Cesium");
import ArrowPolyline from './ArrowPolyline'
import EventConstant from './EventConstant'
import {
    cartesian3ToQuaternion,
    normalizingQuaternion
} from './math'
import AxisSphere from './AxisSphere'
import CesiumUtils from './CesiumUtils'

export default class TranslationController {
    /**
     * 视图
     * @type {Viewer}
     */
    viewer = null
    /**
     * 模型
     * @type {Cesium.Model}
     */
    model = null
    /**
     * 模型位置
     * @type {Cesium.Cartesian3}
     */
    position = null
    /**
     * z轴
     * @type {ArrowPolyline}
     */
    axisZ = null
    /**
     * x轴
     * @type {ArrowPolyline}
     */
    axisX = null
    /**
     * y轴
     * @type {ArrowPolyline}
     */
    axisY = null
    /**
     * 操作杆集合
     * @type {Cesium.PrimitiveCollection}
     */
    primitives = null
    primitiveCollection = null
    /**
     * 从摄像头发出与视窗上一点相交的射线
     */
    pickRay = new Cesium.Ray()
    /**
     * 当前操作轴
     * @type {ArrowPolyline}
     */
    axis = null
    /**
     * Z旋转轴
     * @type {AxisSphere}
     */
    axisSphereZ = null
    /**
     * X旋转轴
     * @type {AxisSphere}
     */
    axisSphereX = null
    /**
     * Y旋转轴
     * @type {AxisSphere}
     */
    axisSphereY = null
    /**
     * 辅助球
     * @type {Cesium.Primitive}
     */
    auxiliaryBall = null
    /**
     * 鼠标监听事件
     * @type {Cesium.Event}
     */
    handler = null 

    constructor(viewer) {
        this.viewer = viewer
    }

    /**
     * 鼠标是否按下
     * @type {Boolean}
     */
    left_press = false
    /**
     * 添加到模型编辑器 *** 注意创建模型时 矩阵必须为本地矩阵, 否则移动方向会是跟随球心矩阵 ***
     * @param model{Cesium.Model}
     */
    add(model) {

        this.destroy()
        this.model = model
        this.position = Cesium.Matrix4.getTranslation(
            model.modelMatrix,
            new Cesium.Cartesian3()
        )
        // this.primitives = this.viewer.dataSourceManager.createPrimitives('TranslationController');
        this.primitiveCollection = new Cesium.PrimitiveCollection()
        // this.primitiveCollection.destroyPrimitives = false;
        this.primitives = this.viewer.scene.primitives.add(this.primitiveCollection)

        // 创建平移轴
        this._createRod()
        // 旋转平移轴
        this._rotationRod()
        // 添加平移轴
        this._addRod()

        // 创建旋转轴
        this._createSphereAxis()
        // 旋转旋转轴
        this._rotationSphereAxis()
        // 添加旋转轴
        this._addSphereAxis()
        // 添加辅助球
        this._addAuxiliaryBall(this.model.boundingSphere.radius * 2, Cesium.Color.RED.withAlpha(0.2))
        // 添加监听器
        this._addListener()
    }

    // 添加监听器
    _addListener() {
        // this.viewer.eventManager = new Cesium.Event()
        // this.viewer.eventManager.addEventListener(EventConstant.LEFT_DOWN, this._clickListener, true)
        // this.viewer.eventManager.addEventListener(EventConstant.LEFT_UP, this._clickUpListener)
        // this.viewer.eventManager.addEventListener(EventConstant.MOUSE_MOVE, this._moveListener)

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let _this = this;
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.handler.setInputAction(function (event) {
            _this._clickListener()
            _this.left_press = true
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        this.handler.setInputAction(function (event) {
            _this._clickUpListener()
            _this.left_press = false
        }, Cesium.ScreenSpaceEventType.LEFT_UP);
        this.handler.setInputAction(function (event) {
            _this._moveListener(event)
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    }

    // 清除操纵杆, 监听器
    destroy() {

        if (!this.primitiveCollection || this.primitiveCollection.isDestroyed()) return
        this._removeListener();
        this.viewer.scene.primitives.remove(this.primitiveCollection)
        // this.primitiveCollection.destroyPrimitives = false;
        // this.primitiveCollection.removeAll()
        // this.primitiveCollection.destroy()
        // this.viewer.dataSourceManager.removePrimitives('TranslationController')
    }

    // 移除监听器
    _removeListener() {
        this.handler.destroy();
        // this.viewer.eventManager.removeEventListener(EventConstant.LEFT_DOWN, this._clickListener)
        // this.viewer.eventManager.removeEventListener(EventConstant.LEFT_UP, this._clickUpListener)
        // this.viewer.eventManager.removeEventListener(EventConstant.MOUSE_MOVE, this._moveListener)
    }

    // 创建操作杆
    // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
    _createRod() {

        const boundingShpere = this.model.boundingSphere
        const radius = boundingShpere.radius
        const options = {

            width: radius / 15,
            headWidth: radius / 6,
            length: radius * 5, //坐标轴的长度应该视模型的直径而定
            headLength: radius / 3,
            position: this.position
        }
        // 向上的向量
        const vectorNormalUp = new Cesium.Cartesian3()
        const vZ = new Cesium.Cartesian3(0, 0, 1)
        Cesium.Cartesian3.normalize(this.position.clone(), vectorNormalUp)

        // 向右的向量
        const vectorNormalRight = new Cesium.Cartesian3()
        // 由z轴向上 地表向上两个向量叉乘, 则可以得出, 向右的向量
        Cesium.Cartesian3.cross(vZ, vectorNormalUp, vectorNormalRight)
        Cesium.Cartesian3.normalize(vectorNormalRight, vectorNormalRight)

        // 向前的向量
        const vectorNormalFront = new Cesium.Cartesian3()
        Cesium.Cartesian3.cross(vectorNormalRight, vectorNormalUp, vectorNormalFront)
        Cesium.Cartesian3.multiplyByScalar(vectorNormalFront, -1, vectorNormalFront)
        Cesium.Cartesian3.normalize(vectorNormalFront, vectorNormalFront)
        this.axisX = new ArrowPolyline({

            id: 'axisX',
            color: Cesium.Color.GREEN,
            direction: vectorNormalRight,
            unit: Cesium.Cartesian3.UNIT_X,
            ...options
        })
        this.axisZ = new ArrowPolyline({

            id: 'axisZ',
            color: Cesium.Color.RED,
            direction: vectorNormalUp,
            unit: Cesium.Cartesian3.UNIT_Z,
            ...options
        })
        this.axisY = new ArrowPolyline({

            id: 'axisY',
            color: Cesium.Color.BLUE,
            direction: vectorNormalFront,
            unit: Cesium.Cartesian3.UNIT_Y,
            ...options
        })
    }

    // 添加操作杆
    _addRod() {

        this.primitiveCollection.add(this.axisZ.primitive)
        this.primitiveCollection.add(this.axisX.primitive)
        this.primitiveCollection.add(this.axisY.primitive)
    }

    // 初始化操作杆
    _rotationRod() {

        const mx = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(90))
        const rotationX = Cesium.Matrix4.fromRotationTranslation(mx)
        this.axisX.rotation(rotationX)
        const my = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(90))
        const rotationY = Cesium.Matrix4.fromRotationTranslation(my)
        this.axisY.rotation(rotationY)
    }

    // 点击监听
    _clickListener = (e) => {

        if (this.translationAxisIsSelected() || this.rotationAxisIsSelected()) {

            this.viewer.scene.screenSpaceCameraController.enableRotate = false
        }
    }

    /**
     * 平移轴被选中
     * @return {boolean}
     */
    translationAxisIsSelected() {

        return this.axisX.selected || this.axisY.selected || this.axisZ.selected
    }

    /**
     * 旋转轴被选中
     * @return {boolean}
     */
    rotationAxisIsSelected() {

        return this.axisSphereZ.selected || this.axisSphereX.selected || this.axisSphereY.selected
    }

    _clickUpListener = () => {

        this.axis = null
        this.viewer.scene.screenSpaceCameraController.enableRotate = true
        this.auxiliaryBall.show = false
        let curPosition = kadierTollh(this.position)
        console.log('当前模型位置: ', curPosition)
    }
    // 移动监听
    _moveListener = (e) => {
        let _this = this;
        const pick = this.viewer.scene.pick(e.endPosition)
        // const pick = this.viewer.scene.pick(e.message.endPosition)

        // 如果鼠标左键没有按下
        if(!this.left_press){
            this._resetMaterial()
        }else if(this.axis && this.left_press){
            if (_this.translationAxisIsSelected()) {
    
                _this._precessTranslation(e, _this.axis)
            } else if (_this.rotationAxisIsSelected() || (pick && pick.id && pick.id === 'auxiliaryBall') || (pick && pick.id && _this.axis.is(pick.id))) {

                _this._precessRotation(e, _this.axis)
            }
            return
        }

        if (pick && pick.id) {

            this._resetMaterial()
            let axis = null
            if (this.axisX.is(pick.id)) {

                axis = this.axisX
            } else if (this.axisY.is(pick.id)) {

                axis = this.axisY
            } else if (this.axisZ.is(pick.id)) {

                axis = this.axisZ
            } else if (this.axisSphereX.is(pick.id)) {

                axis = this.axisSphereX
            } else if (this.axisSphereY.is(pick.id)) {

                axis = this.axisSphereY
            } else if (this.axisSphereZ.is(pick.id)) {

                axis = this.axisSphereZ
            }
            if (axis) {

                this.axis = axis
                this.axis.select()
                if (this.rotationAxisIsSelected()) {

                    this.auxiliaryBall.show = true
                }
            }
        }
    }

    /**
     * 处理平移
     * @param e
     * @param axis{AxisSphere}
     * @private
     */
    _precessRotation(e, axis) {

        this.auxiliaryBall.show = true

        // 通过射线, 获取在平面上的位置
        this.viewer.camera.getPickRay(e.startPosition, this.pickRay)
        const vtStart = this.getPlaneRotationPosition(this.position, this.viewer.camera.position.clone(), this.pickRay, axis.direction)
        this.viewer.camera.getPickRay(e.endPosition, this.pickRay)
        const vtEnd = this.getPlaneRotationPosition(this.position, this.viewer.camera.position.clone(), this.pickRay, axis.direction)

        // 利用叉乘性质判断方向
        const cartesian = Cesium.Cartesian3.cross(vtStart, vtEnd, new Cesium.Cartesian3())
        const angle = Cesium.Math.toDegrees(Cesium.Cartesian3.angleBetween(cartesian, axis.direction))
        let rotateAngleInRadians = Cesium.Cartesian3.angleBetween(vtEnd, vtStart)
        if (angle > 1) {

            rotateAngleInRadians = -rotateAngleInRadians
        }

        let mx = null
        if (axis.id === 'axisSphereX') {

            mx = Cesium.Matrix3.fromRotationX(rotateAngleInRadians)
        } else if (axis.id === 'axisSphereY') {

            mx = Cesium.Matrix3.fromRotationY(rotateAngleInRadians)
        } else if (axis.id === 'axisSphereZ') {

            mx = Cesium.Matrix3.fromRotationZ(rotateAngleInRadians)
        }
        const rotationX = Cesium.Matrix4.fromRotationTranslation(mx)
        this.rotation(rotationX, axis, rotateAngleInRadians)
    }

    /**
     * 旋转
     * @param rotationX{Cesium.Matrix4} 旋轉角度
     * @param axis{AxisSphere}
     * @param rotateAngleInRadians
     */
    rotation(rotationX, axis, rotateAngleInRadians) {

        this.axisSphereX.rotationAxis(rotationX)
        this.axisSphereY.rotationAxis(rotationX)
        this.axisSphereZ.rotationAxis(rotationX)
        this.axisX.rotationAxis(rotationX)
        this.axisY.rotationAxis(rotationX)
        this.axisZ.rotationAxis(rotationX)
        this._rotateVectorByAxisForAngle(this.axisX.direction, axis.direction, rotateAngleInRadians)
        this._rotateVectorByAxisForAngle(this.axisY.direction, axis.direction, rotateAngleInRadians)
        this._rotateVectorByAxisForAngle(this.axisZ.direction, axis.direction, rotateAngleInRadians)
        Cesium.Matrix4.multiply(
            this.model.modelMatrix,
            rotationX,
            this.model.modelMatrix
        )
        const number = Cesium.Math.toDegrees(rotateAngleInRadians)
        axis.updateAngle(number)
    }

    /**
     * 处理选中
     * @param e{
        {message: {startPosition: Cesium.Cartesian2, endPosition: Cesium.Cartesian2}}}
     * @param axis{ArrowPolyline}
     * @private
     */
    _precessTranslation(e, axis) {

        this.auxiliaryBall.show = false

        // 基于射线, 获取平面上的位置
        this.viewer.camera.getPickRay(e.startPosition, this.pickRay)
        const startPosition = this.getPlanePosition(this.position, this.viewer.camera.position.clone(), this.pickRay, axis.direction)
        this.viewer.camera.getPickRay(e.endPosition, this.pickRay)
        const endPosition = this.getPlanePosition(this.position, this.viewer.camera.position.clone(), this.pickRay, axis.direction)

        // 获取移动长度, 并对该轴点乘, 获取在该轴实际移动的距离
        const moveVector = new Cesium.Cartesian3()
        Cesium.Cartesian3.subtract(endPosition, startPosition, moveVector)
        let moveLength = Cesium.Cartesian3.dot(axis.direction, moveVector)
        this.translation(moveVector, axis.unit, moveLength)
    }

    /**
     * 平移
     * @param moveVector
     * @param unit
     * @param moveLength
     */
    translation(moveVector, unit, moveLength) {

        this.axisX.translation(moveVector, unit, moveLength)
        this.axisY.translation(moveVector, unit, moveLength)
        this.axisZ.translation(moveVector, unit, moveLength)
        this.axisSphereX.translation(moveVector, unit, moveLength)
        this.axisSphereY.translation(moveVector, unit, moveLength)
        this.axisSphereZ.translation(moveVector, unit, moveLength)

        const matrix4 = this.model.modelMatrix.clone(new Cesium.Matrix4())

        // 更新模型位置
        Cesium.Matrix4.multiplyByTranslation(
            this.model.modelMatrix,
            Cesium.Cartesian3.multiplyByScalar(unit, moveLength, new Cesium.Cartesian3()),
            this.model.modelMatrix
        )
        Cesium.Matrix4.getTranslation(this.model.modelMatrix, this.position)

        // 辅助球的坐标系为球心坐标, 需要获取本地矩阵移动距离, 修改辅助球位置
        Cesium.Matrix4.subtract(this.model.modelMatrix, matrix4, matrix4)
        const cartesian3 = Cesium.Matrix4.getTranslation(matrix4, new Cesium.Cartesian3())
        Cesium.Matrix4.multiplyByTranslation(
            this.auxiliaryBall.modelMatrix,
            cartesian3,
            this.auxiliaryBall.modelMatrix
        )
    }

    // 复位所有的材质
    _resetMaterial() {

        this.axisX.rest()
        this.axisY.rest()
        this.axisZ.rest()
        this.axisSphereY.rest()
        this.axisSphereZ.rest()
        this.axisSphereX.rest()
        this.auxiliaryBall.show = false
    }

    // 创建 旋转轴
    _createSphereAxis() {

        const radius = this.model.boundingSphere.radius * 2
        this.axisSphereZ = new AxisSphere('axisSphereZ', radius, this.position, Cesium.Color.RED)
        this.axisSphereX = new AxisSphere('axisSphereX', radius, this.position, Cesium.Color.GREEN)
        this.axisSphereY = new AxisSphere('axisSphereY', radius, this.position, Cesium.Color.BLUE)
        this.axisSphereZ.direction = this.axisZ.direction
        this.axisSphereX.direction = this.axisX.direction
        this.axisSphereY.direction = this.axisY.direction
    }

    // 旋转 旋转轴
    _rotationSphereAxis() {

        const mx = Cesium.Matrix3.fromRotationY(Cesium.Math.toRadians(90))
        const rotationX = Cesium.Matrix4.fromRotationTranslation(mx)
        this.axisSphereX.rotation(rotationX)
        const my = Cesium.Matrix3.fromRotationX(Cesium.Math.toRadians(90))
        const rotationY = Cesium.Matrix4.fromRotationTranslation(my)
        this.axisSphereY.rotation(rotationY)
    }

    // 添加旋转轴
    _addSphereAxis() {

        this.primitiveCollection.add(this.axisSphereZ.primitive)
        this.primitiveCollection.add(this.axisSphereY.primitive)
        this.primitiveCollection.add(this.axisSphereX.primitive)
    }

    /**
     * 添加辅助球  *** 选中时高亮 ***
     * @param {number} radius
     * @param {Cesium.Color} color
     */
    _addAuxiliaryBall(radius, color) {

        const cartesian3 = CesiumUtils.extended(this.position, -radius)
        const modelMatrix = Cesium.Matrix4.multiplyByTranslation(
            Cesium.Transforms.eastNorthUpToFixedFrame(cartesian3),
            new Cesium.Cartesian3(0.0, 0.0, radius),
            new Cesium.Matrix4()
        );

        const sphereGeometry = new Cesium.SphereGeometry({

            vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
            radius: radius,
        });
        const sphereInstance = new Cesium.GeometryInstance({

            id: 'auxiliaryBall',
            geometry: sphereGeometry,
            modelMatrix: modelMatrix,
            attributes: {

                color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                    color
                ),
            },
        });

        this.auxiliaryBall = this.primitiveCollection.add(
            new Cesium.Primitive({

                geometryInstances: sphereInstance,
                appearance: new Cesium.PerInstanceColorAppearance({

                    translucent: true,
                    closed: true,
                }),
            })
        )
        this.auxiliaryBall.show = false
    }

    /**
     * 通过轴旋转角度
     * @param vector
     * @param axis
     * @param angle
     */
    _rotateVectorByAxisForAngle(vector, axis, angle) {

        const rotateQuaternion = normalizingQuaternion(Cesium.Quaternion.fromAxisAngle(axis, angle, new Cesium.Quaternion()))
        const quaternion = cartesian3ToQuaternion(vector)
        Cesium.Quaternion.multiply(
            Cesium.Quaternion.multiply(
                rotateQuaternion,
                quaternion,
                quaternion
            ),
            Cesium.Quaternion.inverse(rotateQuaternion, new Cesium.Quaternion()),
            quaternion
        )
        vector.x = quaternion.x
        vector.y = quaternion.y
        vector.z = quaternion.z
        return quaternion
    }

    /**
     * 获取平面上的位置
     * @param position{Cesium.Cartesian3} 模型位置
     * @param cameraPosition{Cesium.Cartesian3} 相机位置
     * @param pickRay{Cesium.Ray} 从相机到屏幕的射线
     * @param axisDirection{Cesium.Cartesian3} 轴的向量
     */
    getPlanePosition(position, cameraPosition, pickRay, axisDirection) {

        // 第一步, 获取相机在轴上的投影
        const cartesian3 = Cesium.Cartesian3.subtract(cameraPosition, position, new Cesium.Cartesian3())
        const length = Cesium.Cartesian3.dot(cartesian3, axisDirection)
        // 获取轴上投影的位置, 以相机到这个位置, 为平面法线
        Cesium.Cartesian3.multiplyByScalar(axisDirection, length, cartesian3);
        Cesium.Cartesian3.add(position, cartesian3, cartesian3)
        const pn = Cesium.Cartesian3.subtract(cameraPosition, cartesian3, new Cesium.Cartesian3())
        // 获取单位向量, 射线向投影向量投影
        Cesium.Cartesian3.normalize(pn, cartesian3)
        const number = Cesium.Cartesian3.dot(pickRay.direction, cartesian3)
        // 获取射线与平面相交点
        const number1 = Cesium.Cartesian3.magnitude(pn)
        Cesium.Cartesian3.multiplyByScalar(pickRay.direction, -number1 / number, cartesian3);
        return cartesian3
    }

    /**
     * 获取平面上的位置
     * @param position{Cesium.Cartesian3} 模型位置
     * @param cameraPosition{Cesium.Cartesian3} 相机位置
     * @param pickRay{Cesium.Ray} 从相机到屏幕的射线
     * @param axisDirection{Cesium.Cartesian3} 轴的向量
     */
    getPlaneRotationPosition(position, cameraPosition, pickRay, axisDirection) {

        const cartesian3 = Cesium.Cartesian3.subtract(cameraPosition, position, new Cesium.Cartesian3())
        const length = Cesium.Cartesian3.dot(cartesian3, axisDirection)
        const number = Cesium.Cartesian3.dot(pickRay.direction, axisDirection)
        Cesium.Cartesian3.multiplyByScalar(pickRay.direction, -length / number, cartesian3);
        Cesium.Cartesian3.add(cameraPosition, cartesian3, cartesian3)
        return Cesium.Cartesian3.subtract(cartesian3, position, new Cesium.Cartesian3())
    }
}


function kadierTollh(Cartesian3) {
    if (Cesium.defined(Cartesian3)) {
        var cartographic = Cesium.Cartographic.fromCartesian(Cartesian3);
        var lon_f = Cesium.Math.toDegrees(cartographic.longitude); //lon
        var lat_f = Cesium.Math.toDegrees(cartographic.latitude); //lat
        var po_hig = cartographic.height;

        return lon_f +' '+ lat_f +' '+ po_hig

    }
}