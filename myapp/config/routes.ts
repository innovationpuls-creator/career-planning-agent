export default [
  {
    path: '/user',
    layout: false,
    routes: [
      {
        name: 'login',
        path: '/user/login',
        component: './user/login',
      },
      {
        name: 'register',
        path: '/user/register',
        component: './user/register',
      },
    ],
  },
  {
    path: '/admin',
    name: 'admin',
    icon: 'crown',
    access: 'canAdmin',
    routes: [
      {
        path: '/admin',
        redirect: '/admin/user-management',
      },
      {
        path: '/admin/user-management',
        name: 'user-management',
        component: './admin/user-management',
      },
      {
        path: '/admin/job-postings',
        name: 'job-postings',
        component: './admin/job-postings',
      },
      {
        path: '/admin/job-requirement-comparisons',
        name: 'job-requirement-comparisons',
        component: './admin/job-requirement-comparisons',
      },
      {
        path: '/admin/upload-data',
        name: 'upload-data',
        component: './admin/job-knowledge-base',
      },
      {
        path: '/admin/major-distribution',
        name: 'major-distribution',
        icon: 'PieChartOutlined',
        component: './admin/data-dashboard/major-distribution',
      },
      {
        path: '/admin/competency-analysis',
        name: 'competency-analysis',
        icon: 'RadarChartOutlined',
        component: './admin/data-dashboard/competency-analysis',
      },
      {
        path: '/admin/employment-trends',
        name: 'employment-trends',
        icon: 'LineChartOutlined',
        component: './admin/data-dashboard/employment-trends',
      },
    ],
  },
  {
    path: '/',
    access: 'canUser',
    redirect: '/home-v2',
  },
  {
    path: '/home-v2',
    name: '职业规划',
    icon: 'home',
    access: 'canUser',
    component: './home-v2',
  },
  {
    path: '/student-competency-profile',
    name: '简历解构',
    icon: 'dashboard',
    access: 'canUser',
    component: './student-competency-profile',
  },
  {
    path: '/snail-learning-path',
    name: '蜗牛学习路径',
    icon: 'apartment',
    access: 'canUser',
    component: './career-development-report/learning-path',
  },
  {
    path: '/personal-growth-report',
    name: '个人职业成长报告',
    icon: 'fileText',
    access: 'canUser',
    component: './career-development-report/personal-growth-report',
  },
  {
    path: '/career-development-report/personal-growth-report',
    redirect: '/personal-growth-report',
    access: 'canUser',
    hideInMenu: true,
  },
  {
    path: '/job-requirement-profile',
    name: '就业信息知识库',
    icon: 'profile',
    access: 'canUser',
    routes: [
      {
        path: '/job-requirement-profile',
        redirect: '/job-requirement-profile/overview',
      },
      {
        path: '/job-requirement-profile/overview',
        name: '岗位要求图谱总览',
        component: './job-requirement-profile/overview',
      },
      {
        path: '/job-requirement-profile/vertical',
        name: '垂直岗位图谱',
        component: './job-requirement-profile/vertical',
      },
    ],
  },
  {
    path: '*',
    layout: false,
    component: './404',
  },
];
