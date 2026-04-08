// https://umijs.org/config/

import { join } from 'node:path';
import { defineConfig } from '@umijs/max';
import defaultSettings from './defaultSettings';
import proxy from './proxy';

import routes from './routes';

const { REACT_APP_ENV = 'dev' } = process.env;

/**
 * @name 浣跨敤鍏叡璺緞
 * @description 閮ㄧ讲鏃剁殑璺緞锛屽鏋滈儴缃插湪闈炴牴鐩綍涓嬶紝闇€瑕侀厤缃繖涓彉閲?
 * @doc https://umijs.org/docs/api/config#publicpath
 */
const PUBLIC_PATH: string = '/';

export default defineConfig({
  /**
   * @name 寮€鍚?hash 妯″紡
   * @description 璁?build 涔嬪悗鐨勪骇鐗╁寘鍚?hash 鍚庣紑銆傞€氬父鐢ㄤ簬澧為噺鍙戝竷鍜岄伩鍏嶆祻瑙堝櫒鍔犺浇缂撳瓨銆?
   * @doc https://umijs.org/docs/api/config#hash
   */
  hash: true,

  publicPath: PUBLIC_PATH,

  /**
   * @name 鍏煎鎬ц缃?
   * @description 璁剧疆 ie11 涓嶄竴瀹氬畬缇庡吋瀹癸紝闇€瑕佹鏌ヨ嚜宸变娇鐢ㄧ殑鎵€鏈変緷璧?
   * @doc https://umijs.org/docs/api/config#targets
   */
  // targets: {
  //   ie: 11,
  // },
  /**
   * @name 璺敱鐨勯厤缃紝涓嶅湪璺敱涓紩鍏ョ殑鏂囦欢涓嶄細缂栬瘧
   * @description 鍙敮鎸?path锛宑omponent锛宺outes锛宺edirect锛寃rappers锛宼itle 鐨勯厤缃?
   * @doc https://umijs.org/docs/guides/routes
   */
  // umi routes: https://umijs.org/docs/routing
  routes,
  /**
   * @name 涓婚鐨勯厤缃?
   * @description 铏界劧鍙富棰橈紝浣嗘槸鍏跺疄鍙槸 less 鐨勫彉閲忚缃?
   * @doc antd鐨勪富棰樿缃?https://ant.design/docs/react/customize-theme-cn
   * @doc umi 鐨?theme 閰嶇疆 https://umijs.org/docs/api/config#theme
   */
  // theme: { '@primary-color': '#1DA57A' }
  /**
   * @name moment 鐨勫浗闄呭寲閰嶇疆
   * @description 濡傛灉瀵瑰浗闄呭寲娌℃湁瑕佹眰锛屾墦寮€涔嬪悗鑳藉噺灏慾s鐨勫寘澶у皬
   * @doc https://umijs.org/docs/api/config#ignoremomentlocale
   */
  ignoreMomentLocale: true,
  /**
   * @name 浠ｇ悊閰嶇疆
   * @description 鍙互璁╀綘鐨勬湰鍦版湇鍔″櫒浠ｇ悊鍒颁綘鐨勬湇鍔″櫒涓婏紝杩欐牱浣犲氨鍙互璁块棶鏈嶅姟鍣ㄧ殑鏁版嵁浜?
   * @see 瑕佹敞鎰忎互涓?浠ｇ悊鍙兘鍦ㄦ湰鍦板紑鍙戞椂浣跨敤锛宐uild 涔嬪悗灏辨棤娉曚娇鐢ㄤ簡銆?
   * @doc 浠ｇ悊浠嬬粛 https://umijs.org/docs/guides/proxy
   * @doc 浠ｇ悊閰嶇疆 https://umijs.org/docs/api/config#proxy
   */
  proxy: proxy[REACT_APP_ENV as keyof typeof proxy],
  /**
   * @name 蹇€熺儹鏇存柊閰嶇疆
   * @description 涓€涓笉閿欑殑鐑洿鏂扮粍浠讹紝鏇存柊鏃跺彲浠ヤ繚鐣?state
   */
  fastRefresh: true,
  //============== 浠ヤ笅閮芥槸max鐨勬彃浠堕厤缃?===============
  /**
   * @name 鏁版嵁娴佹彃浠?
   * @@doc https://umijs.org/docs/max/data-flow
   */
  model: {},
  /**
   * 涓€涓叏灞€鐨勫垵濮嬫暟鎹祦锛屽彲浠ョ敤瀹冨湪鎻掍欢涔嬮棿鍏变韩鏁版嵁
   * @description 鍙互鐢ㄦ潵瀛樻斁涓€浜涘叏灞€鐨勬暟鎹紝姣斿鐢ㄦ埛淇℃伅锛屾垨鑰呬竴浜涘叏灞€鐨勭姸鎬侊紝鍏ㄥ眬鍒濆鐘舵€佸湪鏁翠釜 Umi 椤圭洰鐨勬渶寮€濮嬪垱寤恒€?
   * @doc https://umijs.org/docs/max/data-flow#%E5%85%A8%E5%B1%80%E5%88%9D%E5%A7%8B%E7%8A%B6%E6%80%81
   */
  initialState: {},
  /**
   * @name layout 鎻掍欢
   * @doc https://umijs.org/docs/max/layout-menu
   */
  title: 'Ant Design Pro',
  layout: {
    locale: true,
    ...defaultSettings,
  },
  /**
   * @name moment2dayjs 鎻掍欢
   * @description 灏嗛」鐩腑鐨?moment 鏇挎崲涓?dayjs
   * @doc https://umijs.org/docs/max/moment2dayjs
   */
  moment2dayjs: {
    preset: 'antd',
    plugins: ['duration'],
  },
  /**
   * @name 鍥介檯鍖栨彃浠?
   * @doc https://umijs.org/docs/max/i18n
   */
  locale: {
    // default zh-CN
    default: 'zh-CN',
    antd: true,
    // default true, when it is true, will use `navigator.language` overwrite default
    baseNavigator: true,
  },
  /**
   * @name antd 鎻掍欢
   * @description 鍐呯疆浜?babel import 鎻掍欢
   * @doc https://umijs.org/docs/max/antd#antd
   */
  antd: {
    appConfig: {},
    configProvider: {
      theme: {
        cssVar: true,
        token: {
          fontFamily: 'AlibabaSans, sans-serif',
        },
      },
    },
  },
  /**
   * @name 缃戠粶璇锋眰閰嶇疆
   * @description 瀹冨熀浜?axios 鍜?ahooks 鐨?useRequest 鎻愪緵浜嗕竴濂楃粺涓€鐨勭綉缁滆姹傚拰閿欒澶勭悊鏂规銆?
   * @doc https://umijs.org/docs/max/request
   */
  request: {},
  /**
   * @name 鏉冮檺鎻掍欢
   * @description 鍩轰簬 initialState 鐨勬潈闄愭彃浠讹紝蹇呴』鍏堟墦寮€ initialState
   * @doc https://umijs.org/docs/max/access
   */
  access: {},
  /**
   * @name <head> 涓澶栫殑 script
   * @description 閰嶇疆 <head> 涓澶栫殑 script
   */
  headScripts: [
    // 瑙ｅ喅棣栨鍔犺浇鏃剁櫧灞忕殑闂
    { src: join(PUBLIC_PATH, 'scripts/loading.js'), async: true },
  ],
  //================ pro 鎻掍欢閰嶇疆 =================
  presets: ['umi-presets-pro'],
  /**
   * @name openAPI 鎻掍欢鐨勯厤缃?
   * @description 鍩轰簬 openapi 鐨勮鑼冪敓鎴恠erve 鍜宮ock锛岃兘鍑忓皯寰堝鏍锋澘浠ｇ爜
   * @doc https://pro.ant.design/zh-cn/docs/openapi/
   */
  openAPI: [
    {
      requestLibPath: "import { request } from '@umijs/max'",
      // 鎴栬€呬娇鐢ㄥ湪绾跨殑鐗堟湰
      // schemaPath: "https://gw.alipayobjects.com/os/antfincdn/M%24jrzTTYJN/oneapi.json"
      schemaPath: join(__dirname, 'oneapi.json'),
      mock: false,
    },
    {
      requestLibPath: "import { request } from '@umijs/max'",
      schemaPath:
        'https://gw.alipayobjects.com/os/antfincdn/CA1dOm%2631B/openapi.json',
      projectName: 'swagger',
    },
  ],
  mock: {
    include: ['mock/**/*', 'src/pages/**/_mock.ts'],
  },
  /**
   * @name 鏄惁寮€鍚?mako
   * @description 浣跨敤 mako 鏋侀€熺爺鍙?
   * @doc https://umijs.org/docs/api/config#mako
   */
  mako: {},
  esbuildMinifyIIFE: true,
  requestRecord: {},
  exportStatic: {},
});
