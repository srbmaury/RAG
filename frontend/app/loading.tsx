export default function Loading(){
 return <main className="app-loading" role="status" aria-label="Loading Atlas workspace">
  <aside className="loading-sidebar"><div className="loading-bar" style={{width:'55%',height:22}}/><div className="loading-bar" style={{width:'85%'}}/><div className="loading-bar" style={{width:'75%'}}/><div className="loading-bar" style={{width:'80%'}}/></aside>
  <div className="loading-main"><div className="loading-bar" style={{width:'30%',height:20}}/><div className="loading-bar" style={{width:'70%',height:40}}/><div className="loading-bar" style={{width:'100%',height:180}}/></div>
 </main>;
}
