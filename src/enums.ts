/** Allowed Action Types */
export enum AllowedAction {
  /** Add an Admin */
  ADD_ADMIN = 'add-admin',
  /** Add a User */
  ADD_USER = 'add-user',
  /** Close a Class */
  CLOSE = 'close',
  /** Create a Class */
  CREATE = 'create',
  /** Remove an Admin */
  REMOVE_ADMIN = 'remove-admin',
  /** Remove a User */
  REMOVE_USER = 'remove-user'
}

/** Common Constants */
export enum Common {
  /** Organization */
  TEMPLATE_OWNER = 'mharm-msft',
  /** Template Repository */
  TEMPLATE_REPO = 'gh-github-intermediate-template'
}
