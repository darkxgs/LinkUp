var ft=Object.defineProperty;var Ae=e=>{throw TypeError(e)};var mt=(e,t,n)=>t in e?ft(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n;var A=(e,t,n)=>mt(e,typeof t!="symbol"?t+"":t,n),Oe=(e,t,n)=>t.has(e)||Ae("Cannot "+n);var d=(e,t,n)=>(Oe(e,t,"read from private field"),n?n.call(e):t.get(e)),B=(e,t,n)=>t.has(e)?Ae("Cannot add the same private member more than once"):t instanceof WeakSet?t.add(e):t.set(e,n),ee=(e,t,n,s)=>(Oe(e,t,"write to private field"),s?s.call(e,n):t.set(e,n),n);import{d7 as re,d8 as _t,d9 as gt,da as wt,db as Et,dc as bt,dd as qe,de as yt,df as Rt,dg as Tt,dh as vt,di as At,dj as ke,dk as Ot,dl as kt,dm as Ut,dn as Ue,dp as It}from"./index-CNoPtOgY.js";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ze="firebasestorage.googleapis.com",We="storageBucket",St=2*60*1e3,Ct=10*60*1e3,Lt=1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class E extends bt{constructor(t,n,s=0){super(fe(t),`Firebase Storage: ${n} (${fe(t)})`),this.status_=s,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,E.prototype)}get status(){return this.status_}set status(t){this.status_=t}_codeEquals(t){return fe(t)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(t){this.customData.serverResponse=t,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var _;(function(e){e.UNKNOWN="unknown",e.OBJECT_NOT_FOUND="object-not-found",e.BUCKET_NOT_FOUND="bucket-not-found",e.PROJECT_NOT_FOUND="project-not-found",e.QUOTA_EXCEEDED="quota-exceeded",e.UNAUTHENTICATED="unauthenticated",e.UNAUTHORIZED="unauthorized",e.UNAUTHORIZED_APP="unauthorized-app",e.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",e.INVALID_CHECKSUM="invalid-checksum",e.CANCELED="canceled",e.INVALID_EVENT_NAME="invalid-event-name",e.INVALID_URL="invalid-url",e.INVALID_DEFAULT_BUCKET="invalid-default-bucket",e.NO_DEFAULT_BUCKET="no-default-bucket",e.CANNOT_SLICE_BLOB="cannot-slice-blob",e.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",e.NO_DOWNLOAD_URL="no-download-url",e.INVALID_ARGUMENT="invalid-argument",e.INVALID_ARGUMENT_COUNT="invalid-argument-count",e.APP_DELETED="app-deleted",e.INVALID_ROOT_OPERATION="invalid-root-operation",e.INVALID_FORMAT="invalid-format",e.INTERNAL_ERROR="internal-error",e.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(_||(_={}));function fe(e){return"storage/"+e}function Ee(){const e="An unknown error occurred, please check the error payload for server response.";return new E(_.UNKNOWN,e)}function Dt(e){return new E(_.OBJECT_NOT_FOUND,"Object '"+e+"' does not exist.")}function xt(e){return new E(_.QUOTA_EXCEEDED,"Quota for bucket '"+e+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function Pt(){const e="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new E(_.UNAUTHENTICATED,e)}function Nt(){return new E(_.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function Mt(e){return new E(_.UNAUTHORIZED,"User does not have permission to access '"+e+"'.")}function He(){return new E(_.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function Ge(){return new E(_.CANCELED,"User canceled the upload/download.")}function $t(e){return new E(_.INVALID_URL,"Invalid URL '"+e+"'.")}function Bt(e){return new E(_.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}function Ft(){return new E(_.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+We+"' property when initializing the app?")}function je(){return new E(_.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function qt(){return new E(_.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function zt(){return new E(_.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function Wt(e){return new E(_.UNSUPPORTED_ENVIRONMENT,`${e} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function ge(e){return new E(_.INVALID_ARGUMENT,e)}function Ve(){return new E(_.APP_DELETED,"The Firebase app was deleted.")}function Ht(e){return new E(_.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function se(e,t){return new E(_.INVALID_FORMAT,"String does not match format '"+e+"': "+t)}function te(e){throw new E(_.INTERNAL_ERROR,"Internal error: "+e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class U{constructor(t,n){this.bucket=t,this.path_=n}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const t=encodeURIComponent;return"/b/"+t(this.bucket)+"/o/"+t(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(t,n){let s;try{s=U.makeFromUrl(t,n)}catch{return new U(t,"")}if(s.path==="")return s;throw Bt(t)}static makeFromUrl(t,n){let s=null;const r="([A-Za-z0-9.\\-_]+)";function o(R){R.path.charAt(R.path.length-1)==="/"&&(R.path_=R.path_.slice(0,-1))}const i="(/(.*))?$",c=new RegExp("^gs://"+r+i,"i"),a={bucket:1,path:3};function u(R){R.path_=decodeURIComponent(R.path)}const h="v[A-Za-z0-9_]+",l=n.replace(/[.]/g,"\\."),p="(/([^?#]*).*)?$",f=new RegExp(`^https?://${l}/${h}/b/${r}/o${p}`,"i"),g={bucket:1,path:3},y=n===ze?"(?:storage.googleapis.com|storage.cloud.google.com)":n,b="([^?#]*)",x=new RegExp(`^https?://${y}/${r}/${b}`,"i"),v=[{regex:c,indices:a,postModify:o},{regex:f,indices:g,postModify:u},{regex:x,indices:{bucket:1,path:2},postModify:u}];for(let R=0;R<v.length;R++){const X=v[R],K=X.regex.exec(t);if(K){const de=K[X.indices.bucket];let Q=K[X.indices.path];Q||(Q=""),s=new U(de,Q),X.postModify(s);break}}if(s==null)throw $t(t);return s}}class Gt{constructor(t){this.promise_=Promise.reject(t)}getPromise(){return this.promise_}cancel(t=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jt(e,t,n){let s=1,r=null,o=null,i=!1,c=0;function a(){return c===2}let u=!1;function h(...b){u||(u=!0,t.apply(null,b))}function l(b){r=setTimeout(()=>{r=null,e(f,a())},b)}function p(){o&&clearTimeout(o)}function f(b,...x){if(u){p();return}if(b){p(),h.call(null,b,...x);return}if(a()||i){p(),h.call(null,b,...x);return}s<64&&(s*=2);let v;c===1?(c=2,v=0):v=(s+Math.random())*1e3,l(v)}let g=!1;function y(b){g||(g=!0,p(),!u&&(r!==null?(b||(c=2),clearTimeout(r),l(0)):b||(c=1)))}return l(0),o=setTimeout(()=>{i=!0,y(!0)},n),y}function Vt(e){e(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xt(e){return e!==void 0}function Kt(e){return typeof e=="function"}function Yt(e){return typeof e=="object"&&!Array.isArray(e)}function he(e){return typeof e=="string"||e instanceof String}function Ie(e){return be()&&e instanceof Blob}function be(){return typeof Blob<"u"}function we(e,t,n,s){if(s<t)throw ge(`Invalid value for '${e}'. Expected ${t} or greater.`);if(s>n)throw ge(`Invalid value for '${e}'. Expected ${n} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Z(e,t,n){let s=t;return n==null&&(s=`https://${t}`),`${n}://${s}/v0${e}`}function Xe(e){const t=encodeURIComponent;let n="?";for(const s in e)if(e.hasOwnProperty(s)){const r=t(s)+"="+t(e[s]);n=n+r+"&"}return n=n.slice(0,-1),n}var G;(function(e){e[e.NO_ERROR=0]="NO_ERROR",e[e.NETWORK_ERROR=1]="NETWORK_ERROR",e[e.ABORT=2]="ABORT"})(G||(G={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ke(e,t){const n=e>=500&&e<600,r=[408,429].indexOf(e)!==-1,o=t.indexOf(e)!==-1;return n||r||o}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zt{constructor(t,n,s,r,o,i,c,a,u,h,l,p=!0,f=!1){this.url_=t,this.method_=n,this.headers_=s,this.body_=r,this.successCodes_=o,this.additionalRetryCodes_=i,this.callback_=c,this.errorCallback_=a,this.timeout_=u,this.progressCallback_=h,this.connectionFactory_=l,this.retry=p,this.isUsingEmulator=f,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((g,y)=>{this.resolve_=g,this.reject_=y,this.start_()})}start_(){const t=(s,r)=>{if(r){s(!1,new ie(!1,null,!0));return}const o=this.connectionFactory_();this.pendingConnection_=o;const i=c=>{const a=c.loaded,u=c.lengthComputable?c.total:-1;this.progressCallback_!==null&&this.progressCallback_(a,u)};this.progressCallback_!==null&&o.addUploadProgressListener(i),o.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&o.removeUploadProgressListener(i),this.pendingConnection_=null;const c=o.getErrorCode()===G.NO_ERROR,a=o.getStatus();if(!c||Ke(a,this.additionalRetryCodes_)&&this.retry){const h=o.getErrorCode()===G.ABORT;s(!1,new ie(!1,null,h));return}const u=this.successCodes_.indexOf(a)!==-1;s(!0,new ie(u,o))})},n=(s,r)=>{const o=this.resolve_,i=this.reject_,c=r.connection;if(r.wasSuccessCode)try{const a=this.callback_(c,c.getResponse());Xt(a)?o(a):o()}catch(a){i(a)}else if(c!==null){const a=Ee();a.serverResponse=c.getErrorText(),this.errorCallback_?i(this.errorCallback_(c,a)):i(a)}else if(r.canceled){const a=this.appDelete_?Ve():Ge();i(a)}else{const a=He();i(a)}};this.canceled_?n(!1,new ie(!1,null,!0)):this.backoffId_=jt(t,n,this.timeout_)}getPromise(){return this.promise_}cancel(t){this.canceled_=!0,this.appDelete_=t||!1,this.backoffId_!==null&&Vt(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class ie{constructor(t,n,s){this.wasSuccessCode=t,this.connection=n,this.canceled=!!s}}function Jt(e,t){t!==null&&t.length>0&&(e.Authorization="Firebase "+t)}function Qt(e,t){e["X-Firebase-Storage-Version"]="webjs/"+(t??"AppManager")}function en(e,t){t&&(e["X-Firebase-GMPID"]=t)}function tn(e,t){t!==null&&(e["X-Firebase-AppCheck"]=t)}function nn(e,t,n,s,r,o,i=!0,c=!1){const a=Xe(e.urlParams),u=e.url+a,h=Object.assign({},e.headers);return en(h,t),Jt(h,n),Qt(h,o),tn(h,s),new Zt(u,e.method,h,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,r,i,c)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sn(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function rn(...e){const t=sn();if(t!==void 0){const n=new t;for(let s=0;s<e.length;s++)n.append(e[s]);return n.getBlob()}else{if(be())return new Blob(e);throw new E(_.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function on(e,t,n){return e.webkitSlice?e.webkitSlice(t,n):e.mozSlice?e.mozSlice(t,n):e.slice?e.slice(t,n):null}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function an(e){if(typeof atob>"u")throw Wt("base-64");return atob(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const L={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class me{constructor(t,n){this.data=t,this.contentType=n||null}}function cn(e,t){switch(e){case L.RAW:return new me(Ye(t));case L.BASE64:case L.BASE64URL:return new me(Ze(e,t));case L.DATA_URL:return new me(ln(t),hn(t))}throw Ee()}function Ye(e){const t=[];for(let n=0;n<e.length;n++){let s=e.charCodeAt(n);if(s<=127)t.push(s);else if(s<=2047)t.push(192|s>>6,128|s&63);else if((s&64512)===55296)if(!(n<e.length-1&&(e.charCodeAt(n+1)&64512)===56320))t.push(239,191,189);else{const o=s,i=e.charCodeAt(++n);s=65536|(o&1023)<<10|i&1023,t.push(240|s>>18,128|s>>12&63,128|s>>6&63,128|s&63)}else(s&64512)===56320?t.push(239,191,189):t.push(224|s>>12,128|s>>6&63,128|s&63)}return new Uint8Array(t)}function un(e){let t;try{t=decodeURIComponent(e)}catch{throw se(L.DATA_URL,"Malformed data URL.")}return Ye(t)}function Ze(e,t){switch(e){case L.BASE64:{const r=t.indexOf("-")!==-1,o=t.indexOf("_")!==-1;if(r||o)throw se(e,"Invalid character '"+(r?"-":"_")+"' found: is it base64url encoded?");break}case L.BASE64URL:{const r=t.indexOf("+")!==-1,o=t.indexOf("/")!==-1;if(r||o)throw se(e,"Invalid character '"+(r?"+":"/")+"' found: is it base64 encoded?");t=t.replace(/-/g,"+").replace(/_/g,"/");break}}let n;try{n=an(t)}catch(r){throw r.message.includes("polyfill")?r:se(e,"Invalid character found")}const s=new Uint8Array(n.length);for(let r=0;r<n.length;r++)s[r]=n.charCodeAt(r);return s}class Je{constructor(t){this.base64=!1,this.contentType=null;const n=t.match(/^data:([^,]+)?,/);if(n===null)throw se(L.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const s=n[1]||null;s!=null&&(this.base64=dn(s,";base64"),this.contentType=this.base64?s.substring(0,s.length-7):s),this.rest=t.substring(t.indexOf(",")+1)}}function ln(e){const t=new Je(e);return t.base64?Ze(L.BASE64,t.rest):un(t.rest)}function hn(e){return new Je(e).contentType}function dn(e,t){return e.length>=t.length?e.substring(e.length-t.length)===t:!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class F{constructor(t,n){let s=0,r="";Ie(t)?(this.data_=t,s=t.size,r=t.type):t instanceof ArrayBuffer?(n?this.data_=new Uint8Array(t):(this.data_=new Uint8Array(t.byteLength),this.data_.set(new Uint8Array(t))),s=this.data_.length):t instanceof Uint8Array&&(n?this.data_=t:(this.data_=new Uint8Array(t.length),this.data_.set(t)),s=t.length),this.size_=s,this.type_=r}size(){return this.size_}type(){return this.type_}slice(t,n){if(Ie(this.data_)){const s=this.data_,r=on(s,t,n);return r===null?null:new F(r)}else{const s=new Uint8Array(this.data_.buffer,t,n-t);return new F(s,!0)}}static getBlob(...t){if(be()){const n=t.map(s=>s instanceof F?s.data_:s);return new F(rn.apply(null,n))}else{const n=t.map(i=>he(i)?cn(L.RAW,i).data:i.data_);let s=0;n.forEach(i=>{s+=i.byteLength});const r=new Uint8Array(s);let o=0;return n.forEach(i=>{for(let c=0;c<i.length;c++)r[o++]=i[c]}),new F(r,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ye(e){let t;try{t=JSON.parse(e)}catch{return null}return Yt(t)?t:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pn(e){if(e.length===0)return null;const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t)}function fn(e,t){const n=t.split("/").filter(s=>s.length>0).join("/");return e.length===0?n:e+"/"+n}function Qe(e){const t=e.lastIndexOf("/",e.length-2);return t===-1?e:e.slice(t+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mn(e,t){return t}class O{constructor(t,n,s,r){this.server=t,this.local=n||t,this.writable=!!s,this.xform=r||mn}}let ae=null;function _n(e){return!he(e)||e.length<2?e:Qe(e)}function et(){if(ae)return ae;const e=[];e.push(new O("bucket")),e.push(new O("generation")),e.push(new O("metageneration")),e.push(new O("name","fullPath",!0));function t(o,i){return _n(i)}const n=new O("name");n.xform=t,e.push(n);function s(o,i){return i!==void 0?Number(i):i}const r=new O("size");return r.xform=s,e.push(r),e.push(new O("timeCreated")),e.push(new O("updated")),e.push(new O("md5Hash",null,!0)),e.push(new O("cacheControl",null,!0)),e.push(new O("contentDisposition",null,!0)),e.push(new O("contentEncoding",null,!0)),e.push(new O("contentLanguage",null,!0)),e.push(new O("contentType",null,!0)),e.push(new O("metadata","customMetadata",!0)),ae=e,ae}function gn(e,t){function n(){const s=e.bucket,r=e.fullPath,o=new U(s,r);return t._makeStorageReference(o)}Object.defineProperty(e,"ref",{get:n})}function wn(e,t,n){const s={};s.type="file";const r=n.length;for(let o=0;o<r;o++){const i=n[o];s[i.local]=i.xform(s,t[i.server])}return gn(s,e),s}function tt(e,t,n){const s=ye(t);return s===null?null:wn(e,s,n)}function En(e,t,n,s){const r=ye(t);if(r===null||!he(r.downloadTokens))return null;const o=r.downloadTokens;if(o.length===0)return null;const i=encodeURIComponent;return o.split(",").map(u=>{const h=e.bucket,l=e.fullPath,p="/b/"+i(h)+"/o/"+i(l),f=Z(p,n,s),g=Xe({alt:"media",token:u});return f+g})[0]}function nt(e,t){const n={},s=t.length;for(let r=0;r<s;r++){const o=t[r];o.writable&&(n[o.server]=e[o.local])}return JSON.stringify(n)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Se="prefixes",Ce="items";function bn(e,t,n){const s={prefixes:[],items:[],nextPageToken:n.nextPageToken};if(n[Se])for(const r of n[Se]){const o=r.replace(/\/$/,""),i=e._makeStorageReference(new U(t,o));s.prefixes.push(i)}if(n[Ce])for(const r of n[Ce]){const o=e._makeStorageReference(new U(t,r.name));s.items.push(o)}return s}function yn(e,t,n){const s=ye(n);return s===null?null:bn(e,t,s)}class V{constructor(t,n,s,r){this.url=t,this.method=n,this.handler=s,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function D(e){if(!e)throw Ee()}function Re(e,t){function n(s,r){const o=tt(e,r,t);return D(o!==null),o}return n}function Rn(e,t){function n(s,r){const o=yn(e,t,r);return D(o!==null),o}return n}function Tn(e,t){function n(s,r){const o=tt(e,r,t);return D(o!==null),En(o,r,e.host,e._protocol)}return n}function J(e){function t(n,s){let r;return n.getStatus()===401?n.getErrorText().includes("Firebase App Check token is invalid")?r=Nt():r=Pt():n.getStatus()===402?r=xt(e.bucket):n.getStatus()===403?r=Mt(e.path):r=s,r.status=n.getStatus(),r.serverResponse=s.serverResponse,r}return t}function st(e){const t=J(e);function n(s,r){let o=t(s,r);return s.getStatus()===404&&(o=Dt(e.path)),o.serverResponse=r.serverResponse,o}return n}function vn(e,t,n){const s=t.fullServerUrl(),r=Z(s,e.host,e._protocol),o="GET",i=e.maxOperationRetryTime,c=new V(r,o,Re(e,n),i);return c.errorHandler=st(t),c}function An(e,t,n,s,r){const o={};t.isRoot?o.prefix="":o.prefix=t.path+"/",n.length>0&&(o.delimiter=n),s&&(o.pageToken=s),r&&(o.maxResults=r);const i=t.bucketOnlyServerUrl(),c=Z(i,e.host,e._protocol),a="GET",u=e.maxOperationRetryTime,h=new V(c,a,Rn(e,t.bucket),u);return h.urlParams=o,h.errorHandler=J(t),h}function On(e,t,n){const s=t.fullServerUrl(),r=Z(s,e.host,e._protocol),o="GET",i=e.maxOperationRetryTime,c=new V(r,o,Tn(e,n),i);return c.errorHandler=st(t),c}function kn(e,t){return e&&e.contentType||t&&t.type()||"application/octet-stream"}function rt(e,t,n){const s=Object.assign({},n);return s.fullPath=e.path,s.size=t.size(),s.contentType||(s.contentType=kn(null,t)),s}function Un(e,t,n,s,r){const o=t.bucketOnlyServerUrl(),i={"X-Goog-Upload-Protocol":"multipart"};function c(){let v="";for(let R=0;R<2;R++)v=v+Math.random().toString().slice(2);return v}const a=c();i["Content-Type"]="multipart/related; boundary="+a;const u=rt(t,s,r),h=nt(u,n),l="--"+a+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+h+`\r
--`+a+`\r
Content-Type: `+u.contentType+`\r
\r
`,p=`\r
--`+a+"--",f=F.getBlob(l,s,p);if(f===null)throw je();const g={name:u.fullPath},y=Z(o,e.host,e._protocol),b="POST",x=e.maxUploadRetryTime,P=new V(y,b,Re(e,n),x);return P.urlParams=g,P.headers=i,P.body=f.uploadData(),P.errorHandler=J(t),P}class ue{constructor(t,n,s,r){this.current=t,this.total=n,this.finalized=!!s,this.metadata=r||null}}function Te(e,t){let n=null;try{n=e.getResponseHeader("X-Goog-Upload-Status")}catch{D(!1)}return D(!!n&&(t||["active"]).indexOf(n)!==-1),n}function In(e,t,n,s,r){const o=t.bucketOnlyServerUrl(),i=rt(t,s,r),c={name:i.fullPath},a=Z(o,e.host,e._protocol),u="POST",h={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":`${s.size()}`,"X-Goog-Upload-Header-Content-Type":i.contentType,"Content-Type":"application/json; charset=utf-8"},l=nt(i,n),p=e.maxUploadRetryTime;function f(y){Te(y);let b;try{b=y.getResponseHeader("X-Goog-Upload-URL")}catch{D(!1)}return D(he(b)),b}const g=new V(a,u,f,p);return g.urlParams=c,g.headers=h,g.body=l,g.errorHandler=J(t),g}function Sn(e,t,n,s){const r={"X-Goog-Upload-Command":"query"};function o(u){const h=Te(u,["active","final"]);let l=null;try{l=u.getResponseHeader("X-Goog-Upload-Size-Received")}catch{D(!1)}l||D(!1);const p=Number(l);return D(!isNaN(p)),new ue(p,s.size(),h==="final")}const i="POST",c=e.maxUploadRetryTime,a=new V(n,i,o,c);return a.headers=r,a.errorHandler=J(t),a}const Le=256*1024;function Cn(e,t,n,s,r,o,i,c){const a=new ue(0,0);if(i?(a.current=i.current,a.total=i.total):(a.current=0,a.total=s.size()),s.size()!==a.total)throw qt();const u=a.total-a.current;let h=u;r>0&&(h=Math.min(h,r));const l=a.current,p=l+h;let f="";h===0?f="finalize":u===h?f="upload, finalize":f="upload";const g={"X-Goog-Upload-Command":f,"X-Goog-Upload-Offset":`${a.current}`},y=s.slice(l,p);if(y===null)throw je();function b(R,X){const K=Te(R,["active","final"]),de=a.current+h,Q=s.size();let pe;return K==="final"?pe=Re(t,o)(R,X):pe=null,new ue(de,Q,K==="final",pe)}const x="POST",P=t.maxUploadRetryTime,v=new V(n,x,b,P);return v.headers=g,v.body=y.uploadData(),v.progressCallback=c||null,v.errorHandler=J(e),v}const I={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};function _e(e){switch(e){case"running":case"pausing":case"canceling":return I.RUNNING;case"paused":return I.PAUSED;case"success":return I.SUCCESS;case"canceled":return I.CANCELED;case"error":return I.ERROR;default:return I.ERROR}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ln{constructor(t,n,s){if(Kt(t)||n!=null||s!=null)this.next=t,this.error=n??void 0,this.complete=s??void 0;else{const o=t;this.next=o.next,this.error=o.error,this.complete=o.complete}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Y(e){return(...t)=>{Promise.resolve().then(()=>e(...t))}}class Dn{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=G.NO_ERROR,this.sendPromise_=new Promise(t=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=G.ABORT,t()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=G.NETWORK_ERROR,t()}),this.xhr_.addEventListener("load",()=>{t()})})}send(t,n,s,r,o){if(this.sent_)throw te("cannot .send() more than once");if(qe(t)&&s&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(n,t,!0),o!==void 0)for(const i in o)o.hasOwnProperty(i)&&this.xhr_.setRequestHeader(i,o[i].toString());return r!==void 0?this.xhr_.send(r):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw te("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw te("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw te("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw te("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(t){return this.xhr_.getResponseHeader(t)}addUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",t)}removeUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",t)}}class xn extends Dn{initXhr(){this.xhr_.responseType="text"}}function z(){return new xn}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pn{isExponentialBackoffExpired(){return this.sleepTime>this.maxSleepTime}constructor(t,n,s=null){this._transferred=0,this._needToFetchStatus=!1,this._needToFetchMetadata=!1,this._observers=[],this._error=void 0,this._uploadUrl=void 0,this._request=void 0,this._chunkMultiplier=1,this._resolve=void 0,this._reject=void 0,this._ref=t,this._blob=n,this._metadata=s,this._mappings=et(),this._resumable=this._shouldDoResumable(this._blob),this._state="running",this._errorHandler=r=>{if(this._request=void 0,this._chunkMultiplier=1,r._codeEquals(_.CANCELED))this._needToFetchStatus=!0,this.completeTransitions_();else{const o=this.isExponentialBackoffExpired();if(Ke(r.status,[]))if(o)r=He();else{this.sleepTime=Math.max(this.sleepTime*2,Lt),this._needToFetchStatus=!0,this.completeTransitions_();return}this._error=r,this._transition("error")}},this._metadataErrorHandler=r=>{this._request=void 0,r._codeEquals(_.CANCELED)?this.completeTransitions_():(this._error=r,this._transition("error"))},this.sleepTime=0,this.maxSleepTime=this._ref.storage.maxUploadRetryTime,this._promise=new Promise((r,o)=>{this._resolve=r,this._reject=o,this._start()}),this._promise.then(null,()=>{})}_makeProgressCallback(){const t=this._transferred;return n=>this._updateProgress(t+n)}_shouldDoResumable(t){return t.size()>256*1024}_start(){this._state==="running"&&this._request===void 0&&(this._resumable?this._uploadUrl===void 0?this._createResumable():this._needToFetchStatus?this._fetchStatus():this._needToFetchMetadata?this._fetchMetadata():this.pendingTimeout=setTimeout(()=>{this.pendingTimeout=void 0,this._continueUpload()},this.sleepTime):this._oneShotUpload())}_resolveToken(t){Promise.all([this._ref.storage._getAuthToken(),this._ref.storage._getAppCheckToken()]).then(([n,s])=>{switch(this._state){case"running":t(n,s);break;case"canceling":this._transition("canceled");break;case"pausing":this._transition("paused");break}})}_createResumable(){this._resolveToken((t,n)=>{const s=In(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),r=this._ref.storage._makeRequest(s,z,t,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._uploadUrl=o,this._needToFetchStatus=!1,this.completeTransitions_()},this._errorHandler)})}_fetchStatus(){const t=this._uploadUrl;this._resolveToken((n,s)=>{const r=Sn(this._ref.storage,this._ref._location,t,this._blob),o=this._ref.storage._makeRequest(r,z,n,s);this._request=o,o.getPromise().then(i=>{i=i,this._request=void 0,this._updateProgress(i.current),this._needToFetchStatus=!1,i.finalized&&(this._needToFetchMetadata=!0),this.completeTransitions_()},this._errorHandler)})}_continueUpload(){const t=Le*this._chunkMultiplier,n=new ue(this._transferred,this._blob.size()),s=this._uploadUrl;this._resolveToken((r,o)=>{let i;try{i=Cn(this._ref._location,this._ref.storage,s,this._blob,t,this._mappings,n,this._makeProgressCallback())}catch(a){this._error=a,this._transition("error");return}const c=this._ref.storage._makeRequest(i,z,r,o,!1);this._request=c,c.getPromise().then(a=>{this._increaseMultiplier(),this._request=void 0,this._updateProgress(a.current),a.finalized?(this._metadata=a.metadata,this._transition("success")):this.completeTransitions_()},this._errorHandler)})}_increaseMultiplier(){Le*this._chunkMultiplier*2<32*1024*1024&&(this._chunkMultiplier*=2)}_fetchMetadata(){this._resolveToken((t,n)=>{const s=vn(this._ref.storage,this._ref._location,this._mappings),r=this._ref.storage._makeRequest(s,z,t,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._metadata=o,this._transition("success")},this._metadataErrorHandler)})}_oneShotUpload(){this._resolveToken((t,n)=>{const s=Un(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),r=this._ref.storage._makeRequest(s,z,t,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._metadata=o,this._updateProgress(this._blob.size()),this._transition("success")},this._errorHandler)})}_updateProgress(t){const n=this._transferred;this._transferred=t,this._transferred!==n&&this._notifyObservers()}_transition(t){if(this._state!==t)switch(t){case"canceling":case"pausing":this._state=t,this._request!==void 0?this._request.cancel():this.pendingTimeout&&(clearTimeout(this.pendingTimeout),this.pendingTimeout=void 0,this.completeTransitions_());break;case"running":const n=this._state==="paused";this._state=t,n&&(this._notifyObservers(),this._start());break;case"paused":this._state=t,this._notifyObservers();break;case"canceled":this._error=Ge(),this._state=t,this._notifyObservers();break;case"error":this._state=t,this._notifyObservers();break;case"success":this._state=t,this._notifyObservers();break}}completeTransitions_(){switch(this._state){case"pausing":this._transition("paused");break;case"canceling":this._transition("canceled");break;case"running":this._start();break}}get snapshot(){const t=_e(this._state);return{bytesTransferred:this._transferred,totalBytes:this._blob.size(),state:t,metadata:this._metadata,task:this,ref:this._ref}}on(t,n,s,r){const o=new Ln(n||void 0,s||void 0,r||void 0);return this._addObserver(o),()=>{this._removeObserver(o)}}then(t,n){return this._promise.then(t,n)}catch(t){return this.then(null,t)}_addObserver(t){this._observers.push(t),this._notifyObserver(t)}_removeObserver(t){const n=this._observers.indexOf(t);n!==-1&&this._observers.splice(n,1)}_notifyObservers(){this._finishPromise(),this._observers.slice().forEach(n=>{this._notifyObserver(n)})}_finishPromise(){if(this._resolve!==void 0){let t=!0;switch(_e(this._state)){case I.SUCCESS:Y(this._resolve.bind(null,this.snapshot))();break;case I.CANCELED:case I.ERROR:const n=this._reject;Y(n.bind(null,this._error))();break;default:t=!1;break}t&&(this._resolve=void 0,this._reject=void 0)}}_notifyObserver(t){switch(_e(this._state)){case I.RUNNING:case I.PAUSED:t.next&&Y(t.next.bind(t,this.snapshot))();break;case I.SUCCESS:t.complete&&Y(t.complete.bind(t))();break;case I.CANCELED:case I.ERROR:t.error&&Y(t.error.bind(t,this._error))();break;default:t.error&&Y(t.error.bind(t,this._error))()}}resume(){const t=this._state==="paused"||this._state==="pausing";return t&&this._transition("running"),t}pause(){const t=this._state==="running";return t&&this._transition("pausing"),t}cancel(){const t=this._state==="running"||this._state==="pausing";return t&&this._transition("canceling"),t}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class j{constructor(t,n){this._service=t,n instanceof U?this._location=n:this._location=U.makeFromUrl(n,t.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(t,n){return new j(t,n)}get root(){const t=new U(this._location.bucket,"");return this._newRef(this._service,t)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return Qe(this._location.path)}get storage(){return this._service}get parent(){const t=pn(this._location.path);if(t===null)return null;const n=new U(this._location.bucket,t);return new j(this._service,n)}_throwIfRoot(t){if(this._location.path==="")throw Ht(t)}}function Nn(e,t,n){return e._throwIfRoot("uploadBytesResumable"),new Pn(e,new F(t),n)}function Mn(e){const t={prefixes:[],items:[]};return ot(e,t).then(()=>t)}async function ot(e,t,n){const r=await $n(e,{pageToken:n});t.prefixes.push(...r.prefixes),t.items.push(...r.items),r.nextPageToken!=null&&await ot(e,t,r.nextPageToken)}function $n(e,t){t!=null&&typeof t.maxResults=="number"&&we("options.maxResults",1,1e3,t.maxResults);const n=t||{},s=An(e.storage,e._location,"/",n.pageToken,n.maxResults);return e.storage.makeRequestWithTokens(s,z)}function Bn(e){e._throwIfRoot("getDownloadURL");const t=On(e.storage,e._location,et());return e.storage.makeRequestWithTokens(t,z).then(n=>{if(n===null)throw zt();return n})}function Fn(e,t){const n=fn(e._location.path,t),s=new U(e._location.bucket,n);return new j(e.storage,s)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qn(e){return/^[A-Za-z]+:\/\//.test(e)}function zn(e,t){return new j(e,t)}function it(e,t){if(e instanceof ve){const n=e;if(n._bucket==null)throw Ft();const s=new j(n,n._bucket);return t!=null?it(s,t):s}else return t!==void 0?Fn(e,t):e}function Wn(e,t){if(t&&qn(t)){if(e instanceof ve)return zn(e,t);throw ge("To use ref(service, url), the first argument must be a Storage instance.")}else return it(e,t)}function De(e,t){const n=t==null?void 0:t[We];return n==null?null:U.makeFromBucketSpec(n,e)}function Hn(e,t,n,s={}){e.host=`${t}:${n}`;const r=qe(t);r&&(yt(`https://${e.host}/b`),Rt("Storage",!0)),e._isUsingEmulator=!0,e._protocol=r?"https":"http";const{mockUserToken:o}=s;o&&(e._overrideAuthToken=typeof o=="string"?o:Tt(o,e.app.options.projectId))}class ve{constructor(t,n,s,r,o,i=!1){this.app=t,this._authProvider=n,this._appCheckProvider=s,this._url=r,this._firebaseVersion=o,this._isUsingEmulator=i,this._bucket=null,this._host=ze,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=St,this._maxUploadRetryTime=Ct,this._requests=new Set,r!=null?this._bucket=U.makeFromBucketSpec(r,this._host):this._bucket=De(this._host,this.app.options)}get host(){return this._host}set host(t){this._host=t,this._url!=null?this._bucket=U.makeFromBucketSpec(this._url,t):this._bucket=De(t,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(t){we("time",0,Number.POSITIVE_INFINITY,t),this._maxUploadRetryTime=t}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(t){we("time",0,Number.POSITIVE_INFINITY,t),this._maxOperationRetryTime=t}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const t=this._authProvider.getImmediate({optional:!0});if(t){const n=await t.getToken();if(n!==null)return n.accessToken}return null}async _getAppCheckToken(){if(_t(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const t=this._appCheckProvider.getImmediate({optional:!0});return t?(await t.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(t=>t.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(t){return new j(this,t)}_makeRequest(t,n,s,r,o=!0){if(this._deleted)return new Gt(Ve());{const i=nn(t,this._appId,s,r,n,this._firebaseVersion,o,this._isUsingEmulator);return this._requests.add(i),i.getPromise().then(()=>this._requests.delete(i),()=>this._requests.delete(i)),i}}async makeRequestWithTokens(t,n){const[s,r]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(t,n,s,r).getPromise()}}const xe="@firebase/storage",Pe="0.13.14";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const at="storage";function Gn(e,t,n){return e=re(e),Nn(e,t,n)}function Ne(e){return e=re(e),Mn(e)}function ct(e){return e=re(e),Bn(e)}function ut(e,t){return e=re(e),Wn(e,t)}function jn(e=Et(),t){e=re(e);const s=gt(e,at).getImmediate({identifier:t}),r=wt("storage");return r&&Vn(s,...r),s}function Vn(e,t,n,s={}){Hn(e,t,n,s)}function Xn(e,{instanceIdentifier:t}){const n=e.getProvider("app").getImmediate(),s=e.getProvider("auth-internal"),r=e.getProvider("app-check-internal");return new ve(n,s,r,t,Ot)}function Kn(){vt(new At(at,Xn,"PUBLIC").setMultipleInstances(!0)),ke(xe,Pe,""),ke(xe,Pe,"esm2017")}Kn();var m;(function(e){e.LOAD="LOAD",e.EXEC="EXEC",e.FFPROBE="FFPROBE",e.WRITE_FILE="WRITE_FILE",e.READ_FILE="READ_FILE",e.DELETE_FILE="DELETE_FILE",e.RENAME="RENAME",e.CREATE_DIR="CREATE_DIR",e.LIST_DIR="LIST_DIR",e.DELETE_DIR="DELETE_DIR",e.ERROR="ERROR",e.DOWNLOAD="DOWNLOAD",e.PROGRESS="PROGRESS",e.LOG="LOG",e.MOUNT="MOUNT",e.UNMOUNT="UNMOUNT"})(m||(m={}));const Yn=(()=>{let e=0;return()=>e++})(),Zn=new Error("ffmpeg is not loaded, call `await ffmpeg.load()` first"),Jn=new Error("called FFmpeg.terminate()");var S,q,N,W,H,le,k;class Qn{constructor(){B(this,S,null);B(this,q,{});B(this,N,{});B(this,W,[]);B(this,H,[]);A(this,"loaded",!1);B(this,le,()=>{d(this,S)&&(d(this,S).onmessage=({data:{id:t,type:n,data:s}})=>{switch(n){case m.LOAD:this.loaded=!0,d(this,q)[t](s);break;case m.MOUNT:case m.UNMOUNT:case m.EXEC:case m.FFPROBE:case m.WRITE_FILE:case m.READ_FILE:case m.DELETE_FILE:case m.RENAME:case m.CREATE_DIR:case m.LIST_DIR:case m.DELETE_DIR:d(this,q)[t](s);break;case m.LOG:d(this,W).forEach(r=>r(s));break;case m.PROGRESS:d(this,H).forEach(r=>r(s));break;case m.ERROR:d(this,N)[t](s);break}delete d(this,q)[t],delete d(this,N)[t]})});B(this,k,({type:t,data:n},s=[],r)=>d(this,S)?new Promise((o,i)=>{const c=Yn();d(this,S)&&d(this,S).postMessage({id:c,type:t,data:n},s),d(this,q)[c]=o,d(this,N)[c]=i,r==null||r.addEventListener("abort",()=>{i(new DOMException(`Message # ${c} was aborted`,"AbortError"))},{once:!0})}):Promise.reject(Zn));A(this,"load",({classWorkerURL:t,...n}={},{signal:s}={})=>(d(this,S)||(ee(this,S,t?new Worker(new URL(t,import.meta.url),{type:"module"}):new Worker(new URL("/assets/worker-BAOIWoxA.js",import.meta.url),{type:"module"})),d(this,le).call(this)),d(this,k).call(this,{type:m.LOAD,data:n},void 0,s)));A(this,"exec",(t,n=-1,{signal:s}={})=>d(this,k).call(this,{type:m.EXEC,data:{args:t,timeout:n}},void 0,s));A(this,"ffprobe",(t,n=-1,{signal:s}={})=>d(this,k).call(this,{type:m.FFPROBE,data:{args:t,timeout:n}},void 0,s));A(this,"terminate",()=>{const t=Object.keys(d(this,N));for(const n of t)d(this,N)[n](Jn),delete d(this,N)[n],delete d(this,q)[n];d(this,S)&&(d(this,S).terminate(),ee(this,S,null),this.loaded=!1)});A(this,"writeFile",(t,n,{signal:s}={})=>{const r=[];return n instanceof Uint8Array&&r.push(n.buffer),d(this,k).call(this,{type:m.WRITE_FILE,data:{path:t,data:n}},r,s)});A(this,"mount",(t,n,s)=>{const r=[];return d(this,k).call(this,{type:m.MOUNT,data:{fsType:t,options:n,mountPoint:s}},r)});A(this,"unmount",t=>{const n=[];return d(this,k).call(this,{type:m.UNMOUNT,data:{mountPoint:t}},n)});A(this,"readFile",(t,n="binary",{signal:s}={})=>d(this,k).call(this,{type:m.READ_FILE,data:{path:t,encoding:n}},void 0,s));A(this,"deleteFile",(t,{signal:n}={})=>d(this,k).call(this,{type:m.DELETE_FILE,data:{path:t}},void 0,n));A(this,"rename",(t,n,{signal:s}={})=>d(this,k).call(this,{type:m.RENAME,data:{oldPath:t,newPath:n}},void 0,s));A(this,"createDir",(t,{signal:n}={})=>d(this,k).call(this,{type:m.CREATE_DIR,data:{path:t}},void 0,n));A(this,"listDir",(t,{signal:n}={})=>d(this,k).call(this,{type:m.LIST_DIR,data:{path:t}},void 0,n));A(this,"deleteDir",(t,{signal:n}={})=>d(this,k).call(this,{type:m.DELETE_DIR,data:{path:t}},void 0,n))}on(t,n){t==="log"?d(this,W).push(n):t==="progress"&&d(this,H).push(n)}off(t,n){t==="log"?ee(this,W,d(this,W).filter(s=>s!==n)):t==="progress"&&ee(this,H,d(this,H).filter(s=>s!==n))}}S=new WeakMap,q=new WeakMap,N=new WeakMap,W=new WeakMap,H=new WeakMap,le=new WeakMap,k=new WeakMap;var Me;(function(e){e.MEMFS="MEMFS",e.NODEFS="NODEFS",e.NODERAWFS="NODERAWFS",e.IDBFS="IDBFS",e.WORKERFS="WORKERFS",e.PROXYFS="PROXYFS"})(Me||(Me={}));const es=new Error("failed to get response body reader"),ts=new Error("failed to complete download"),ns="Content-Length",ss=e=>new Promise((t,n)=>{const s=new FileReader;s.onload=()=>{const{result:r}=s;r instanceof ArrayBuffer?t(new Uint8Array(r)):t(new Uint8Array)},s.onerror=r=>{var o,i;n(Error(`File could not be read! Code=${((i=(o=r==null?void 0:r.target)==null?void 0:o.error)==null?void 0:i.code)||-1}`))},s.readAsArrayBuffer(e)}),rs=async e=>{let t;if(typeof e=="string")/data:_data\/([a-zA-Z]*);base64,([^"]*)/.test(e)?t=atob(e.split(",")[1]).split("").map(n=>n.charCodeAt(0)):t=await(await fetch(e)).arrayBuffer();else if(e instanceof URL)t=await(await fetch(e)).arrayBuffer();else if(e instanceof File||e instanceof Blob)t=await ss(e);else return new Uint8Array;return new Uint8Array(t)},os=async(e,t)=>{var r;const n=await fetch(e);let s;try{const o=parseInt(n.headers.get(ns)||"-1"),i=(r=n.body)==null?void 0:r.getReader();if(!i)throw es;const c=[];let a=0;for(;;){const{done:l,value:p}=await i.read(),f=p?p.length:0;if(l){if(o!=-1&&o!==a)throw ts;t&&t({url:e,total:o,received:a,delta:f,done:l});break}c.push(p),a+=f,t&&t({url:e,total:o,received:a,delta:f,done:l})}const u=new Uint8Array(a);let h=0;for(const l of c)u.set(l,h),h+=l.length;s=u.buffer}catch(o){console.log("failed to send download progress event: ",o),s=await n.arrayBuffer()}return s},$e=async(e,t,n=!1,s)=>{const r=n?await os(e,s):await(await fetch(e)).arrayBuffer(),o=new Blob([r],{type:t});return URL.createObjectURL(o)},lt="/",is=`${lt}ffmpeg/ffmpeg-core.js`,as=`${lt}ffmpeg/ffmpeg-core.wasm`,cs=3*1024*1024,us=1*1024*1024,ls=1.5*1024*1024,hs=3e4,ds=24e4;class ps extends Error{}function ht(e,t,n){return new Promise((s,r)=>{const o=setTimeout(()=>{n==null||n(),r(new ps(`انتهت المهلة بعد ${Math.round(t/1e3)} ثانية`))},t);e.then(i=>{clearTimeout(o),s(i)},i=>{clearTimeout(o),r(i)})})}let ne=null;function fs(){ne=null}async function ms(e){return ne||(ne=(async()=>{const t=new Qn;return e==null||e({stage:"load",ratio:0}),await ht((async()=>{await t.load({coreURL:await $e(is,"text/javascript"),wasmURL:await $e(as,"application/wasm")})})(),hs,()=>{try{t.terminate()}catch{}}),t})().catch(t=>{throw ne=null,t})),ne}function _s(e){return e.type.startsWith("video/")||/\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(e.name)}function gs(e){return e.type==="image/gif"||/\.gif$/i.test(e.name)}function ws(e){return e.type.startsWith("image/")||/\.(png|jpe?g|webp)$/i.test(e.name)}async function ce(e,t,n,s,r){const o=await ms(r),i=`in_${Date.now()}.${e.name.split(".").pop()||"bin"}`,c=a=>{const u=Math.max(0,Math.min(1,a.progress||0));r==null||r({stage:"transcode",ratio:u})};o.on("progress",c);try{await o.writeFile(i,await rs(e)),await ht(o.exec(n(i,t)),ds,()=>{try{o.terminate()}catch{}fs()});const a=await o.readFile(t);await o.deleteFile(i).catch(()=>{}),await o.deleteFile(t).catch(()=>{}),r==null||r({stage:"done",ratio:1});const u=new Blob([a],{type:s});return new File([u],t,{type:s})}finally{o.off("progress",c)}}async function oe(e,t,n){try{if(_s(e)){if(e.size<cs)return e;if(e.type==="video/webm"||/\.webm$/i.test(e.name)){const o=await ce(e,"compressed.webm",(i,c)=>["-i",i,"-vf","scale='min(1280,iw)':-2","-c:v","libvpx-vp9","-crf","36","-b:v","0","-deadline","realtime","-cpu-used","8","-row-mt","1","-c:a","libopus","-b:a","128k",c],"video/webm",t);return o.size<e.size?o:e}const r=await ce(e,"compressed.mp4",(o,i)=>["-i",o,"-vf","scale='min(1280,iw)':-2","-c:v","libx264","-preset","veryfast","-crf","28","-pix_fmt","yuv420p","-movflags","+faststart","-c:a","aac","-b:a","128k",i],"video/mp4",t);return r.size<e.size?r:e}if(gs(e)){const s=(n==null?void 0:n.gifMinBytes)??us;if(e.size<s)return e;const r=(n==null?void 0:n.maxGifDimension)??480,o=(n==null?void 0:n.gifFps)??15,i=await ce(e,"compressed.gif",(c,a)=>["-i",c,"-vf",`fps=${o},scale='min(${r},iw)':-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer`,a],"image/gif",t);return i.size<e.size?i:e}if(ws(e)){const s=(n==null?void 0:n.imageMinBytes)??ls;if(e.size<s)return e;const r=(n==null?void 0:n.maxImageDimension)??1600,o=(n==null?void 0:n.imageQuality)??82,i=await ce(e,"compressed.webp",(c,a)=>["-i",c,"-vf",`scale='min(${r},iw)':-2`,"-quality",String(o),a],"image/webp",t);return i.size<e.size?i:e}return e}catch(s){return console.warn("[compress] فشل الضغط، سيُرفع الملف الأصلي:",s),e}}const dt=jn(It),Es={thumb:10*1024*1024,animation:25*1024*1024,sound:50*1024*1024,video:50*1024*1024,videoMp4:50*1024*1024},M=15*1024*1024,bs=["image/png","image/jpeg","image/webp","image/gif"],ys=["audio/mpeg","audio/mp3","audio/wav","audio/ogg","audio/x-m4a"],C=["video/mp4","video/quicktime","video/webm","video/x-m4v"],T=e=>`${Math.round(e/(1024*1024))} ميجابايت`;async function pt(){let e=Ue.currentUser;if(e||(e=await new Promise(t=>{const n=setTimeout(()=>t(null),4e3),s=Ue.onAuthStateChanged(r=>{clearTimeout(n),s(),t(r)})})),!e)throw new Error("انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد لرفع الملفات");try{await e.getIdToken(!0)}catch{throw new Error("انتهت جلسة الدخول — سجّل الخروج ثم ادخل من جديد لرفع الملفات")}}function Rs(e){const t=(e==null?void 0:e.code)??"";return t.includes("storage/unauthorized")?"رفض الخادم الرفع — سجّل الخروج ثم ادخل من جديد، أو تأكد من نشر قواعد Storage":t.includes("storage/canceled")?"تم إلغاء الرفع":t.includes("storage/quota-exceeded")?"مساحة التخزين ممتلئة":(e==null?void 0:e.message)??"فشل رفع الملف"}function $(e){var s;if(e.type&&bs.includes(e.type))return e.type;const t=(s=e.name.split(".").pop())==null?void 0:s.toLowerCase(),n={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif"};if(t&&n[t])return n[t];throw new Error("الصيغ المدعومة: PNG, JPG, WebP, GIF")}async function w(e,t,n,s){await pt();const r=ut(dt,e);try{const o=Gn(r,t,{contentType:n});return await new Promise((i,c)=>{o.on("state_changed",a=>{s&&a.totalBytes>0},c,()=>i())}),await ct(r)}catch(o){throw new Error(Rs(o))}}async function ks(e,t,n,s){var c,a,u,h;if(!t.trim())throw new Error("احفظ معرّف الهدية أولاً أو أدخل اسم الهدية");n!=="sound"&&(e=await oe(e,s,n==="thumb"?{maxImageDimension:512,imageQuality:72,imageMinBytes:81920}:n==="animation"?{maxGifDimension:360,gifFps:12,gifMinBytes:256e3}:void 0));const r=Es[n];if(e.size>r)throw new Error(`حجم الملف أكبر من ${T(r)}`);if(n==="video"){const l=((c=e.name.split(".").pop())==null?void 0:c.toLowerCase())||"mp4";if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const p=e.type||(l==="webm"?"video/webm":l==="mov"?"video/quicktime":"video/mp4");return w(`config/gifts/${t}/video.${l}`,e,p)}if(n==="videoMp4"){if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const l=((a=e.name.split(".").pop())==null?void 0:a.toLowerCase())||"mp4",p=e.type||(l==="mov"?"video/quicktime":"video/mp4");return w(`config/gifts/${t}/video_ios.${l}`,e,p)}if(n==="sound"){if(!ys.includes(e.type)&&!e.name.match(/\.(mp3|wav|ogg|m4a)$/i))throw new Error("الصيغ المدعومة للصوت: MP3, WAV, OGG");const l=((u=e.name.split(".").pop())==null?void 0:u.toLowerCase())||"mp3";return w(`config/gifts/${t}/sound.${l}`,e,e.type||"audio/mpeg")}const o=$(e);if(n==="animation"&&o!=="image/gif"&&!e.name.toLowerCase().endsWith(".gif"))throw new Error("الهدية المتحركة تتطلب ملف GIF");if(n==="thumb"&&o==="image/gif")throw new Error("صورة القائمة: استخدم PNG أو JPG (GIF لنوع «متحركة» فقط)");const i=((h=e.name.split(".").pop())==null?void 0:h.toLowerCase())||"png";return w(`config/gifts/${t}/${n}.${i}`,e,o)}async function Us(e,t,n,s){var a,u,h;if(!t.trim())throw new Error("أدخل معرّف المستوى أو الامتياز أولاً");const r=n==="badge"||n==="privilege"||n==="background"?{maxImageDimension:2048,imageQuality:92,imageMinBytes:2*1024*1024}:n==="badgeAnim"?{maxGifDimension:720,gifFps:15,gifMinBytes:1.5*1024*1024}:void 0;if(e=await oe(e,s,r),n==="video"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);const l=((a=e.name.split(".").pop())==null?void 0:a.toLowerCase())||"mp4";if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const p=e.type||(l==="webm"?"video/webm":l==="mov"?"video/quicktime":"video/mp4");return w(`config/vip/${t}/video.${l}`,e,p)}if(n==="videoMp4"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const l=((u=e.name.split(".").pop())==null?void 0:u.toLowerCase())||"mp4",p=e.type||(l==="mov"?"video/quicktime":"video/mp4");return w(`config/vip/${t}/video_ios.${l}`,e,p)}const o=n==="badgeAnim"?25*1024*1024:n==="privilege"||n==="background"?35*1024*1024:10*1024*1024;if(e.size>o)throw new Error(`حجم الملف أكبر من ${T(o)}`);const i=$(e);if(n==="badgeAnim"&&i!=="image/gif"&&!e.name.toLowerCase().endsWith(".gif"))throw new Error("الشارة المتحركة تتطلب ملف GIF");const c=((h=e.name.split(".").pop())==null?void 0:h.toLowerCase())||"png";return w(`config/vip/${t}/${n}.${c}`,e,i)}async function Is(e,t,n,s){var i,c,a;if(!t.trim())throw new Error("أدخل معرّف التصنيف أو الامتياز أولاً");if(e=await oe(e,s),n==="video"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const u=((i=e.name.split(".").pop())==null?void 0:i.toLowerCase())||"mp4",h=e.type||(u==="webm"?"video/webm":u==="mov"?"video/quicktime":"video/mp4");return w(`config/aristocracy/${t}/video.${u}`,e,h)}if(n==="videoMp4"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const u=((c=e.name.split(".").pop())==null?void 0:c.toLowerCase())||"mp4",h=e.type||(u==="mov"?"video/quicktime":"video/mp4");return w(`config/aristocracy/${t}/video_ios.${u}`,e,h)}if(e.size>35*1024*1024)throw new Error(`حجم الملف أكبر من ${T(35*1024*1024)}`);const r=$(e),o=((a=e.name.split(".").pop())==null?void 0:a.toLowerCase())||"png";return w(`config/aristocracy/${t}/${n}.${o}`,e,r)}const Be=["noble","minister","prince","king","aristocrat"];async function Ss(e,t){const n=new Blob([JSON.stringify(t)],{type:"application/json"}),s=new File([n],"meta.json",{type:"application/json"});await w(`config/aristocracy/${e}/meta.json`,s,"application/json")}async function Ts(){const e=ut(dt,"config/aristocracy"),t=await Ne(e),n=[];for(const s of t.prefixes){const r=s.name;if(Be.includes(r))continue;let o="",i="";for(const f of Be)if(r.startsWith(`${f}_`)){o=f,i=r.slice(f.length+1);break}if(!o||!i)continue;const c=await Ne(s);let a,u,h,l;for(const f of c.items){const g=f.name.toLowerCase(),y=await ct(f);if(g==="meta.json"){try{l=await(await fetch(y)).json()}catch{}continue}g.startsWith("privilege.")||g.startsWith("emblem.")?a=y:g.startsWith("video_ios.")?h=y:g.startsWith("video.")&&(u=y)}if(!a&&!u&&!h)continue;const p=(l==null?void 0:l.assetKey)||(u||h?"entry":"badge");n.push({storageId:r,levelId:(l==null?void 0:l.levelId)||o,privId:(l==null?void 0:l.privId)||i,assetKey:p,titleAr:l==null?void 0:l.titleAr,titleEn:l==null?void 0:l.titleEn,imageUrl:a,videoUrl:u,videoUrlMp4:h})}return n}async function Cs(){await pt();try{return(await kt(Ut,"adminDiscoverAristocracyUploads")({})).data.uploads??[]}catch(e){const t=(e==null?void 0:e.code)??"";if(t!=="functions/not-found"&&t!=="functions/unavailable")throw e;try{return await Ts()}catch(n){throw((n==null?void 0:n.code)??"").includes("storage/unauthorized")?new Error("رفض Storage — انشر قواعد Storage والـ Cloud Function adminDiscoverAristocracyUploads ثم أعد المحاولة"):n}}}async function Ls(e,t,n){var i,c,a;if(e=await oe(e,n),t==="entry-video"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const u=((i=e.name.split(".").pop())==null?void 0:i.toLowerCase())||"mp4",h=e.type||(u==="webm"?"video/webm":u==="mov"?"video/quicktime":"video/mp4");return w(`config/agency-prince/entry-video.${u}`,e,h)}if(t==="entry-video-ios"){if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const u=((c=e.name.split(".").pop())==null?void 0:c.toLowerCase())||"mp4",h=e.type||(u==="mov"?"video/quicktime":"video/mp4");return w(`config/agency-prince/entry-video_ios.${u}`,e,h)}if(e.size>25*1024*1024)throw new Error(`حجم الملف أكبر من ${T(25*1024*1024)}`);const s=t==="entry-animation"&&/video|gif/i.test(e.type),r=s?e.type:$(e),o=((a=e.name.split(".").pop())==null?void 0:a.toLowerCase())||(s?"mp4":"png");return w(`config/agency-prince/${t}.${o}`,e,r)}async function Ds(e,t,n,s){var c,a,u;if(!t.trim())throw new Error("أدخل معرّف العنصر أولاً");e=await oe(e,s);const r=n==="animation"||n==="video"||n==="videoMp4"?25*1024*1024:M;if(e.size>r)throw new Error(`حجم الملف أكبر من ${T(r)}`);if(n==="video"){const h=((c=e.name.split(".").pop())==null?void 0:c.toLowerCase())||"mp4";if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const l=e.type||(h==="webm"?"video/webm":h==="mov"?"video/quicktime":"video/mp4");return w(`config/store/${t}/video.${h}`,e,l)}if(n==="videoMp4"){if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const h=((a=e.name.split(".").pop())==null?void 0:a.toLowerCase())||"mp4",l=e.type||(h==="mov"?"video/quicktime":"video/mp4");return w(`config/store/${t}/video_ios.${h}`,e,l)}const o=$(e);if(n==="animation"&&o!=="image/gif"&&!e.name.toLowerCase().endsWith(".gif"))throw new Error("الأنيميشن يتطلب ملف GIF");const i=((u=e.name.split(".").pop())==null?void 0:u.toLowerCase())||"png";return w(`config/store/${t}/${n}.${i}`,e,o)}async function xs(e,t,n){var o;if(!n.trim())throw new Error("معرّف العنصر غير صالح");if(e.size>M)throw new Error(`حجم الملف أكبر من ${T(M)}`);const s=$(e),r=((o=e.name.split(".").pop())==null?void 0:o.toLowerCase())||"png";return w(`config/${t}/${n}/image.${r}`,e,s)}async function Ps(e,t){return vs(e,t,"icon")}async function vs(e,t,n){var o;if(!t.trim()||!n.trim())throw new Error("احفظ معرّف التصنيف والصورة أولاً");if(e.size>M)throw new Error(`حجم الملف أكبر من ${T(M)}`);const s=$(e),r=((o=e.name.split(".").pop())==null?void 0:o.toLowerCase())||"png";return w(`config/room-reactions/${t}/${n}/image.${r}`,e,s)}async function Ns(e,t,n){var o;if(!t.trim())throw new Error("معرّف الموظف غير صالح");if(e.size>M)throw new Error(`حجم الملف أكبر من ${T(M)}`);const s=n==="frame"&&(e.type==="image/gif"||e.name.toLowerCase().endsWith(".gif"))?"image/gif":$(e),r=((o=e.name.split(".").pop())==null?void 0:o.toLowerCase())||(s==="image/gif"?"gif":"png");return w(`config/staff/${t}/${n}.${r}`,e,s)}async function Ms(e,t,n){var o,i;if(!t.trim())throw new Error("معرّف الموظف غير صالح");if(e.size>50*1024*1024)throw new Error(`حجم الملف أكبر من ${T(50*1024*1024)}`);if(n==="video"){const c=((o=e.name.split(".").pop())==null?void 0:o.toLowerCase())||"mp4";if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|webm|m4v)$/i))throw new Error("الصيغ المدعومة للفيديو: MP4, MOV, WebM");const a=e.type||(c==="webm"?"video/webm":c==="mov"?"video/quicktime":"video/mp4");return w(`config/staff/${t}/entry-video.${c}`,e,a)}if(!C.includes(e.type)&&!e.name.match(/\.(mp4|mov|m4v)$/i))throw new Error("الصيغ المدعومة للاحتياطي: MP4, MOV");const s=((i=e.name.split(".").pop())==null?void 0:i.toLowerCase())||"mp4",r=e.type||(s==="mov"?"video/quicktime":"video/mp4");return w(`config/staff/${t}/entry-video_ios.${s}`,e,r)}async function $s(e,t,n){var o;if(!t.trim())throw new Error("معرّف الموظف غير صالح");if(e.size>M)throw new Error(`حجم الملف أكبر من ${T(M)}`);const s=e.type==="image/gif"||e.name.toLowerCase().endsWith(".gif")?"image/gif":$(e),r=((o=e.name.split(".").pop())==null?void 0:o.toLowerCase())||(s==="image/gif"?"gif":"png");return w(`config/staff/${t}/agency-${n}.${r}`,e,s)}const Fe=150*1024*1024;async function Bs(e,t){const n=t.trim();if(!n)throw new Error("أدخل رقم الإصدار أولاً (مثل 1.2.0)");if(!e.name.toLowerCase().endsWith(".apk"))throw new Error("الملف يجب أن يكون بصيغة APK");if(e.size>Fe)throw new Error(`حجم APK أكبر من ${T(Fe)}`);const r=n.replace(/[^a-zA-Z0-9._-]/g,"_");return w(`config/releases/${r}/linkup.apk`,e,"application/vnd.android.package-archive")}export{$s as a,Ns as b,Ms as c,ks as d,Ds as e,vs as f,Ps as g,Us as h,Ls as i,Bs as j,Cs as k,Is as l,Ss as s,xs as u};
