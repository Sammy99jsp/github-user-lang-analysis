# GitHub Language Analysis

Hey, this is just a quick tool to analyze
programming languages of multiple users at once,
which can be helpful in determining a tech stack,
or just seeing what's popular.

## Setup

1. Install dependencies using NPM, `npm install`
2. Compile using `tsc` or `npm run build`
3. Add a new [Github Personal Token](https://github.com/settings/tokens) to a `.env` file:
```
TOKEN="YOUR_TOKEN_HERE"
```


## Using the tool
Run: `npm run analyze -- {users}`

**Note**: Separate usernames with a space in between them. Do not use commas.

### Example

```shell
npm run analyze -- Sammy99jsp Fireship
```

## Output
You should find the output in  ``
