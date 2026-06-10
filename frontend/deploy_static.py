import paramiko, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('216.173.70.241', username='root', password='REDACTED')
def run(cmd):
    stdin, stdout, stderr = client.exec_command(cmd)
    return stdout.read().decode('utf-8','replace')+stderr.read().decode('utf-8','replace')

sftp = client.open_sftp()
sftp.put('C:/ABSTRACT_COINDECK/static.tar.gz', '/tmp/static.tar.gz')
sftp.close()
print("uploaded")

print(run("mkdir -p /var/www/abstract-coindeck/.next/static"))
print(run("tar -xzf /tmp/static.tar.gz -C /var/www/abstract-coindeck/.next/static 2>&1 | head -5"))
print(run("ls /var/www/abstract-coindeck/.next/static/chunks | wc -l"))
print(run("curl -s -o /dev/null -w '%{http_code}\n' https://escape.isgood.host/_next/static/chunks/18d467v.h_cve.js"))
client.close()
