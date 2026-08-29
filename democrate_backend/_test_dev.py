import urllib.request, json
boundary='----WebKitFormBoundary7MA4YWxkTrZu0gW'
r1 = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:5000/api/v1/auth/developer/login', json.dumps({'username':'developer', 'password':'Developer@123', 'role':'developer'}).encode(), {'Content-Type':'application/json'}))
temp = json.loads(r1.read())['temp_token']
body=f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="secret.key"\r\nContent-Type: text/plain\r\n\r\nThisIsTheSecretUnlockKeyForDemocrateDeveloper2026\r\n--{boundary}--\r\n'.encode()
r2 = urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:5000/api/v1/auth/developer/unlock', body, {'Content-Type':f'multipart/form-data; boundary={boundary}', 'Authorization':f'Bearer {temp}'}))
dev = json.loads(r2.read())['access_token']
print("Got dev token:", dev)
try:
    r3 = urllib.request.Request('http://127.0.0.1:5000/api/v1/developer/audit', headers={'Cookie':f'access_token={dev}'})
    print(urllib.request.urlopen(r3).read())
except Exception as e:
    print(e.read())
