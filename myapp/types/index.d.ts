export namespace API {
  export type GET_API_CURRENT_USER_RES = {
    data: {
      name: string;
      avatar?: string;
      userid: string;
      access: string;
    };
    success: boolean;
  };

  export type POST_API_LOGIN_OUT_LOGIN_RES = {
    data: Record<string, any>;
    success: boolean;
  };

  export type POST_API_LOGIN_ACCOUNT_PAYLOAD = {
    username: string;
    password: string;
    autoLogin?: boolean;
    type: string;
  };

  export type POST_API_LOGIN_ACCOUNT_RES = {
    success: boolean;
    status: string;
    type: string;
    currentAuthority: string;
    token: string;
  };
}
