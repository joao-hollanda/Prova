# syntax=docker/dockerfile:1
# Imagem única: a API ASP.NET serve o front React (mesma origem). Bom para PaaS.

# 1) Build do front (React/Vite) -> /front/dist
FROM node:20-alpine AS front
WORKDIR /front
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Build/publish da API (.NET 9) com o front embutido em wwwroot
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS api
WORKDIR /src
COPY api/*.csproj ./api/
RUN dotnet restore api/Pf.Api.csproj
COPY api/ ./api/
COPY --from=front /front/dist ./api/wwwroot
RUN dotnet publish api/Pf.Api.csproj -c Release -o /app /p:UseAppHost=false

# 3) Runtime enxuto
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=api /app ./
# A maioria das PaaS injeta PORT; default 8080. O banco vem de DATABASE_URL/POSTGRES_CONNECTION_STRING.
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Pf.Api.dll"]
