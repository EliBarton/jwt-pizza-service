const config = require('./config.js');
const os = require('os');

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function sendMetricsPeriodically(period) {
  const timer = setInterval(() => {
    try {
      const buf = new MetricBuilder();
      httpMetrics(buf);
      systemMetrics(buf);
      userMetrics(buf);
      purchaseMetrics(buf);
      authMetrics(buf);

      const metrics = buf.toString('\n');
      this.sendMetricToGrafana(metrics);
    } catch (error) {
      console.log('Error sending metrics', error);
    }
  }, period);
}



class Metrics {
  constructor() {
    this.totalRequests = 0;
    this.postRequests = 0;
    this.deleteRequests = 0;
    this.getRequests = 0;
    this.putRequests = 0;

    this.activeUsers = 0;
    this.activeAuths = [];

    this.cpuUsagePercentage = getCpuUsagePercentage();
    this.memoryUsagePercentage = getMemoryUsagePercentage();

    this.authenticationSuccesses = 0;
    this.authenticationFailures = 0;

    this.pizzaPurchases = 0;
    this.purchaseFailures = 0;
    this.revenue = 0;

    this.requestLatency = 0;
    this.pizzaLatency = 0;

    // This will periodically sent metrics to Grafana
    const timer = setInterval(() => {
      this.sendMetricToGrafana('request', 'all', 'total', this.totalRequests);
      this.sendMetricToGrafana('request', 'post', 'total', this.postRequests);
      this.sendMetricToGrafana('request', 'delete', 'total', this.deleteRequests);
      this.sendMetricToGrafana('request', 'get', 'total', this.getRequests);
      this.sendMetricToGrafana('request', 'put', 'total', this.putRequests);
      this.sendMetricToGrafana('users', 'active', 'total', this.activeUsers);
      this.sendMetricToGrafana('auth', 'success', 'total', this.authenticationSuccesses);
      this.sendMetricToGrafana('auth', 'fail', 'total', this.authenticationFailures);
      this.sendMetricToGrafana('cpu', 'usage', 'percentage', this.cpuUsagePercentage);  
      this.sendMetricToGrafana('memory', 'usage', 'percentage', this.memoryUsagePercentage);
      this.sendMetricToGrafana('pizza', 'purchases', 'total', this.pizzaPurchases);
      this.sendMetricToGrafana('pizza', 'failures', 'total', this.purchaseFailures);
      this.sendMetricToGrafana('money', 'revenue', 'total', this.revenue);
      this.sendMetricToGrafana('latency', 'creation', 'total', this.pizzaLatency);
      this.sendMetricToGrafana('latency', 'request', 'total', this.requestLatency);
    }, 2000); 
    timer.unref();
  }

  requestTracker = (req, res, next) => {
    const start = Date.now();
      
      // Log incoming request
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
      
      switch (req.method) {
          case 'POST':
              this.incrementRequests('post');
              break;
          case 'DELETE':
              this.incrementRequests('delete');
              if (req.url === '/api/auth') {
                this.activeUsers--;
              }
              break;
          case 'GET':
              this.incrementRequests('get');
              break;
          case 'PUT':
              this.incrementRequests('put');
              break;
          default:
              break;
      }

      // Track active users
      if (!this.activeAuths.includes(req.headers.authorization)) {
        this.activeAuths.push(req.headers.authorization);
        this.activeUsers++;
      }

      // Track authentication attempts
      if (req.url === '/api/auth' && req.method === 'PUT') {
        res.on('finish', () => {
            // Check status code after response is complete
            if (res.statusCode === 200) {
                this.authenticationSuccesses++;
            } else {
                this.authenticationFailures++;
            }
        });
      }

      // Track pizza purchases
      if (req.url === '/api/order' && req.method === 'POST') {
        res.on('finish', () => {
            // Check status code after response is complete
            this.pizzaLatency = Date.now() - start;
            if (res.statusCode === 200) {
                this.pizzaPurchases++;
                for (let i = 0; i < req.body.items.length; i++) {
                    this.revenue += req.body.items[i].price;
                }
            } else {
                this.purchaseFailures++;
            }
          });
        }
      


      // Capture the response's finish event to log when it completes
      res.on('finish', () => {
          const duration = Date.now() - start;
          this.requestLatency = duration;
          console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} ${duration}ms`);
      });
      
      next(); // Pass control to the next middleware
  }

  incrementRequests(httpMethod) {
    if (httpMethod === 'post') {
      this.postRequests++;
    } else if (httpMethod === 'delete') {
      this.deleteRequests++;
    } else if (httpMethod === 'get') {
      this.getRequests++;
    } else if (httpMethod === 'put') {
      this.putRequests++;
    }
    this.totalRequests++;
  }

  sendMetricToGrafana(metricPrefix, httpMethod, metricName, metricValue) {
    const metric = `${metricPrefix},source=${config.metrics.source},method=${httpMethod} ${metricName}=${metricValue}`;

    fetch(`${config.metrics.url}`, {
      method: 'post',
      body: metric,
      headers: { Authorization: `Bearer ${config.metrics.userId}:${config.metrics.apiKey}` },
    })
      .then((response) => {
        if (!response.ok) {
          console.error('Failed to push metrics data to Grafana');
        } else {
          console.log(`Pushed ${metric}`);
        }
      })
      .catch((error) => {
        console.error('Error pushing metrics:', error);
      });
  }
}

const metrics = new Metrics();
module.exports = metrics;