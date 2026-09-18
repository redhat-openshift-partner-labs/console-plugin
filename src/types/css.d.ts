declare module '*.css';
declare module '*.yaml' {
  const data: unknown;
  export default data;
}
